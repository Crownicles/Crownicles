import { IMission } from "../IMission";
import {
	ItemCategory, ItemConstants
} from "../../../../../Lib/src/constants/ItemConstants";
import {
	InventorySlot, InventorySlots
} from "../../database/game/models/InventorySlot";
import { Homes } from "../../database/game/models/Home";
import {
	HomeChestSlot, HomeChestSlots
} from "../../database/game/models/HomeChestSlot";
import Player from "../../database/game/models/Player";

const REQUIRED_LEVEL = 5;

/**
 * Whether a weapon or shield qualifies for the mission: epic rarity (or better)
 * and upgraded to at least the required level.
 */
function isEpicItemAtRequiredLevel(rarity: number, level: number): boolean {
	return rarity >= ItemConstants.RARITY.EPIC && level >= REQUIRED_LEVEL;
}

/**
 * Whether an equipped or reserve inventory slot holds a qualifying weapon or shield.
 */
function isQualifyingInventorySlot(slot: InventorySlot): boolean {
	const item = slot.getItem();
	return slot.isPrimaryEquipment() && item !== null && isEpicItemAtRequiredLevel(item.rarity, slot.itemLevel);
}

/**
 * Whether the item category is a weapon or a shield (armor).
 */
function isWeaponOrArmorCategory(category: ItemCategory): boolean {
	return category === ItemCategory.WEAPON || category === ItemCategory.ARMOR;
}

/**
 * Whether a home chest slot holds a qualifying weapon or shield.
 */
function isQualifyingChestSlot(slot: HomeChestSlot): boolean {
	if (slot.isEmpty()) {
		return false;
	}
	if (!isWeaponOrArmorCategory(slot.itemCategory)) {
		return false;
	}
	const item = slot.getItem();
	return item !== null && isEpicItemAtRequiredLevel(item.rarity, slot.itemLevel);
}

/**
 * Whether the player already owns a qualifying weapon or shield, either equipped,
 * in their inventory reserve, or stored in their home chest.
 */
async function ownsQualifyingItem(player: Player): Promise<boolean> {
	const inventorySlots = await InventorySlots.getOfPlayer(player.id);
	if (inventorySlots.some(isQualifyingInventorySlot)) {
		return true;
	}

	const home = await Homes.getOfPlayer(player.id);
	if (!home) {
		return false;
	}
	const chestSlots = await HomeChestSlots.getOfHome(home.id);
	return chestSlots.some(isQualifyingChestSlot);
}

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: (_variant, params) =>
		isEpicItemAtRequiredLevel(params.rarity as number, params.newLevel as number),

	/**
	 * Validate the mission as soon as it is assigned if the player already owns a
	 * qualifying weapon or shield, so they don't have to upgrade an item again.
	 */
	initialNumberDone: async player => await ownsQualifyingItem(player) ? 1 : 0,

	updateSaveBlob: () => null
};
