import {
	BuyCallbackResult,
	CommandShopClosed,
	ShopItem
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
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
import { crowniclesInstance } from "../../index";
import {
	ReactionCollectorBuyCategorySlot,
	ReactionCollectorBuyCategorySlotBuySuccess,
	ReactionCollectorBuyCategorySlotCancelReaction,
	ReactionCollectorBuyCategorySlotReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorBuyCategorySlot";
import { PlantConstants } from "../../../../Lib/src/constants/PlantConstants";
import { PlayerPlantSlots } from "../database/game/models/PlayerPlantSlot";
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

function getBuySlotExtensionShopItemCallback(playerId: number, price: number): EndCallback {
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
		try {
			await withLockedEntities(
				[
					Player.lockKey(player.id),
					InventoryInfo.lockKey(player.id)
				] as const,
				async ([lockedPlayer, lockedInvInfo]) => {
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
		}
		catch (e) {
			if (e instanceof LockedRowNotFoundError) {
				CrowniclesLogger.warn(
					`getBuySlotExtensionShopItemCallback: locked row vanished for player ${player.id} — aborting purchase`
				);
				return;
			}
			throw e;
		}

		if (!success) {
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
		buyCallback: async (_response, _playerId, _context): Promise<BuyCallbackResult> => {
			const player = await Players.getById(playerId);
			const freshInvInfo = await InventoryInfos.getOfPlayer(player.id);

			if (freshInvInfo.plantSlots >= PlantConstants.MAX_PLANT_SLOTS) {
				return { success: false };
			}

			const buyResult: BuyCallbackResult & { postPurchase: () => Promise<void> } = {
				success: true,
				postPurchase: async (): Promise<void> => {
					/*
					 * Lock the InventoryInfo row so the MAX_PLANT_SLOTS check
					 * and the slot increment are atomic against concurrent
					 * plant slot purchases (#3760).
					 */
					try {
						await InventoryInfo.withLocked(player.id, async lockedInvInfo => {
							if (lockedInvInfo.plantSlots >= PlantConstants.MAX_PLANT_SLOTS) {
								return;
							}
							lockedInvInfo.plantSlots++;
							await lockedInvInfo.save();

							// Ensure the new physical slot exists
							await PlayerPlantSlots.ensureSlotsForCount(player.id, lockedInvInfo.plantSlots);
						});
					}
					catch (e) {
						if (e instanceof LockedRowNotFoundError) {
							CrowniclesLogger.warn(
								`getPlantSlotExtensionShopItem.postPurchase: locked row vanished for player ${player.id} — skipping`
							);
							return;
						}
						throw e;
					}
				}
			};

			/*
			 * Return a detailed result so ShopUtils pushes CommandShopGenericPurchase
			 * and the player sees a confirmation message (issue #4208).
			 */
			return buyResult;
		}
	};
}
