import {
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
import { Players } from "../database/game/models/Player";
import { InventoryInfos } from "../database/game/models/InventoryInfo";
import { crowniclesInstance } from "../../index";
import {
	ReactionCollectorBuyCategorySlot,
	ReactionCollectorBuyCategorySlotBuySuccess,
	ReactionCollectorBuyCategorySlotCancelReaction,
	ReactionCollectorBuyCategorySlotReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorBuyCategorySlot";
import { PlantConstants } from "../../../../Lib/src/constants/PlantConstants";
import { PlayerPlantSlots } from "../database/game/models/PlayerPlantSlot";

function getBuySlotExtensionShopItemCallback(playerId: number, price: number): EndCallback {
	return async (collector, response): Promise<void> => {
		const player = await Players.getById(playerId);
		const reaction = collector.getFirstReaction();
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.SLOT_EXTENSION);
		if (!reaction || reaction.reaction.type === ReactionCollectorBuyCategorySlotCancelReaction.name) {
			response.push(makePacket(CommandShopClosed, {}));
			return;
		}

		const invInfo = await InventoryInfos.getOfPlayer(player.id);
		const category = (reaction.reaction.data as ReactionCollectorBuyCategorySlotReaction).categoryId;

		await player.spendMoney({
			amount: price,
			response,
			reason: NumberChangeReason.SHOP
		});
		crowniclesInstance?.logsDatabase.logClassicalShopBuyout(player.keycloakId, ShopItemType.SLOT_EXTENSION)
			.then();
		invInfo.addSlotForCategory(category);
		await Promise.all([player.save(), invInfo.save()]);
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
		buyCallback: async (_response, _playerId, _context): Promise<boolean> => {
			const player = await Players.getById(playerId);
			const freshInvInfo = await InventoryInfos.getOfPlayer(player.id);

			freshInvInfo.plantSlots++;
			await freshInvInfo.save();

			// Ensure the new physical slot exists
			await PlayerPlantSlots.ensureSlotsForCount(player.id, freshInvInfo.plantSlots);

			crowniclesInstance?.logsDatabase.logClassicalShopBuyout(player.keycloakId, ShopItemType.PLANT_SLOT_EXTENSION)
				.then();

			return true;
		}
	};
}
