import {
	BuyCallbackResult,
	CommandShopClosed,
	CommandShopGenericPurchase,
	CommandShopNoPlantSlotAvailable,
	CommandShopNotEnoughCurrency,
	ShopItem
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import { ShopCurrency } from "../../../../Lib/src/constants/ShopConstants";
import {
	NumberChangeReason, ShopItemType
} from "../../../../Lib/src/constants/LogsConstants";
import {
	ItemCategory, ItemConstants
} from "../../../../Lib/src/constants/ItemConstants";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	EndCallback, ReactionCollectorInstance
} from "./ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "./BlockingUtils";
import {
	Player, Players
} from "../database/game/models/Player";
import {
	InventoryInfo, InventoryInfos
} from "../database/game/models/InventoryInfo";
import { crowniclesInstance } from "../../app";
import {
	ReactionCollectorBuyCategorySlot,
	ReactionCollectorBuyCategorySlotBuySuccess,
	ReactionCollectorBuyCategorySlotCancelReaction,
	ReactionCollectorBuyCategorySlotReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorBuyCategorySlot";
import { PlantConstants } from "../../../../Lib/src/constants/PlantConstants";
import { PlayerPlantSlots } from "../database/game/models/PlayerPlantSlot";
import { withLockedEntitiesSafe } from "./withLockedEntitiesSafe";

// Exported for race tests; the inner `withLockedEntitiesSafe` block is the unit under test.
export function getBuySlotExtensionShopItemCallback(playerId: number, price: number): EndCallback {
	return async (collector, response): Promise<void> => {
		const player = await Players.getById(playerId);
		const reaction = collector.getFirstReaction();
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.SLOT_EXTENSION);
		if (!reaction || reaction.reaction.type === ReactionCollectorBuyCategorySlotCancelReaction.name) {
			response.push(makePacket(CommandShopClosed, {}));
			return;
		}
		const category = (reaction.reaction.data as ReactionCollectorBuyCategorySlotReaction).categoryId;

		// Pre-warm the InventoryInfo row so the lock can pin it
		await InventoryInfos.getOfPlayer(player.id);

		/*
		 * Lock Player + InventoryInfo together so the money spend and the
		 * slot count increment are atomic with respect to other purchases
		 * — otherwise two concurrent slot extensions could double-spend
		 * money or lose an inventory slot increment (#3760).
		 */
		let success = false;
		const ranToCompletion = await withLockedEntitiesSafe(
			[
				Player.lockKey(player.id),
				InventoryInfo.lockKey(player.id)
			] as const,
			"getBuySlotExtensionShopItemCallback",
			async ([lockedPlayer, lockedInvInfo]) => {
				/*
				 * Re-validate affordability against the freshly locked
				 * row: `Player.spendMoney` does not enforce a
				 * non-negative balance, so a concurrent spend between
				 * the initial shop display and this deferred callback
				 * could drive the player negative without this check.
				 */
				if (lockedPlayer.money < price) {
					response.push(makePacket(CommandShopNotEnoughCurrency, {
						missingCurrency: price - lockedPlayer.money,
						currency: ShopCurrency.MONEY
					}));
					return;
				}
				await lockedPlayer.spendMoney({
					amount: price,
					response,
					reason: NumberChangeReason.SHOP
				});
				lockedInvInfo.addSlotForCategory(category);
				await Promise.all([lockedPlayer.save(), lockedInvInfo.save()]);
				success = true;
			}
		);

		if (!ranToCompletion || !success) {
			return;
		}

		crowniclesInstance?.logsDatabase.logClassicalShopBuyout(player.keycloakId, ShopItemType.SLOT_EXTENSION, 1, player.getCurrentCityId() ?? undefined)
			.then();
		response.push(makePacket(ReactionCollectorBuyCategorySlotBuySuccess, {}));
	};
}

/**
 * Get the shop item for extending your inventory
 */
export async function getSlotExtensionShopItem(playerId: number): Promise<ShopItem | null> {
	const player = await Players.getById(playerId);
	const invInfo = await InventoryInfos.getOfPlayer(player.id);
	const availableSlotsPerCategory = [
		ItemCategory.WEAPON,
		ItemCategory.ARMOR,
		ItemCategory.POTION,
		ItemCategory.OBJECT
	]
		.map(itemCategory => ItemConstants.SLOTS.LIMITS[itemCategory] - invInfo.slotLimitForCategory(itemCategory));
	if (availableSlotsPerCategory.every(availableCategory => availableCategory <= 0)) {
		return null;
	}
	const totalSlots = invInfo.weaponSlots + invInfo.armorSlots
		+ invInfo.potionSlots + invInfo.objectSlots;
	const baseSlots = ItemConstants.SLOTS.LIMITS.length; // 1 slot per category by default
	const extraSlotsBought = totalSlots - baseSlots;
	const price = ItemConstants.SLOTS.PRICES[extraSlotsBought];
	if (!price) {
		return null;
	}
	return {
		id: ShopItemType.SLOT_EXTENSION,
		price,
		amounts: [1],
		buyCallback: (response, _playerId, context): boolean => {
			const collector = new ReactionCollectorBuyCategorySlot(availableSlotsPerCategory);

			const packet = new ReactionCollectorInstance(
				collector,
				context,
				{
					allowedPlayerKeycloakIds: [player.keycloakId]
				},
				getBuySlotExtensionShopItemCallback(player.id, price)
			)
				.block(player.keycloakId, BlockingConstants.REASONS.SLOT_EXTENSION)
				.build();

			response.push(packet);

			return false; // For this specific callback, we don't want to directly consider the purchase as successful as we need the player to choose a slot category
		}
	};
}

/**
 * Get the shop item for extending plant inventory slots at the tanner
 */
export async function getPlantSlotExtensionShopItem(playerId: number): Promise<ShopItem | null> {
	const invInfo = await InventoryInfos.getOfPlayer(playerId);

	if (invInfo.plantSlots >= PlantConstants.MAX_PLANT_SLOTS) {
		return null;
	}

	const priceIndex = invInfo.plantSlots - PlantConstants.DEFAULT_PLANT_SLOTS;
	const price = PlantConstants.PLANT_SLOT_PRICES[priceIndex];

	if (price === undefined) {
		return null;
	}

	return {
		id: ShopItemType.PLANT_SLOT_EXTENSION,
		price,
		amounts: [1],
		buyCallback: async (response, _playerId, _context): Promise<BuyCallbackResult> => {
			const player = await Players.getById(playerId);

			// Pre-warm the InventoryInfo row so the lock can pin it
			await InventoryInfos.getOfPlayer(player.id);

			/*
			 * Atomicity (#3760): do the MAX_PLANT_SLOTS check, the money
			 * spend, the slot increment AND the success packet push all
			 * inside the same combined Player + InventoryInfo lock. The
			 * previous design did the cap check outside the lock and let
			 * ShopUtils.manageCurrencySpending debit before the
			 * postPurchase lock acquired — so two concurrent buys at
			 * MAX-1 both paid but only one slot was granted.
			 *
			 * We return `{ success: false }` so ShopUtils does NOT manage
			 * currency or push CommandShopGenericPurchase a second time —
			 * everything is already handled atomically below.
			 */
			let purchased = false;
			await withLockedEntitiesSafe(
				[
					Player.lockKey(player.id),
					InventoryInfo.lockKey(player.id)
				] as const,
				"getPlantSlotExtensionShopItem.buyCallback",
				async ([lockedPlayer, lockedInvInfo]) => {
					if (lockedInvInfo.plantSlots >= PlantConstants.MAX_PLANT_SLOTS) {
						/*
						 * A concurrent buyer reached the cap first —
						 * surface a "no slot available" error so the
						 * user actually sees feedback.
						 */
						response.push(makePacket(CommandShopNoPlantSlotAvailable, {}));
						return;
					}
					if (lockedPlayer.money < price) {
						/*
						 * Concurrent spend made this purchase
						 * unaffordable under the lock — surface a
						 * "not enough currency" error packet.
						 */
						response.push(makePacket(CommandShopNotEnoughCurrency, {
							missingCurrency: price - lockedPlayer.money,
							currency: ShopCurrency.MONEY
						}));
						return;
					}
					await lockedPlayer.spendMoney({
						amount: price,
						response,
						reason: NumberChangeReason.SHOP
					});
					lockedInvInfo.plantSlots++;
					await Promise.all([lockedPlayer.save(), lockedInvInfo.save()]);

					/*
					 * ensureSlotsForCount is idempotent and goes through the
					 * same CLS transaction as the increment above.
					 */
					await PlayerPlantSlots.ensureSlotsForCount(player.id, lockedInvInfo.plantSlots);
					purchased = true;
				}
			);

			if (purchased) {
				response.push(makePacket(CommandShopGenericPurchase, {
					shopItemId: ShopItemType.PLANT_SLOT_EXTENSION,
					amount: 1
				}));
				crowniclesInstance?.logsDatabase.logClassicalShopBuyout(
					player.keycloakId,
					ShopItemType.PLANT_SLOT_EXTENSION,
					1,
					player.getCurrentCityId() ?? undefined
				)
					.then();
			}
			return { success: false };
		}
	};
}
