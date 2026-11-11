import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import {
	InventorySlot, InventorySlots
} from "../database/game/models/InventorySlot";
import { Homes } from "../database/game/models/Home";
import {
	HomeChestSlot, HomeChestSlots
} from "../database/game/models/HomeChestSlot";
import Player from "../database/game/models/Player";

/**
 * Rarity and upgrade level of a weapon or a shield owned by a player
 */
export type OwnedMainItem = {
	rarity: number;
	level: number;
};

export type OwnedMainItemPredicate = (item: OwnedMainItem) => boolean;

/**
 * Whether an equipped or reserve inventory slot holds a weapon or shield matching the predicate.
 */
function isMatchingInventorySlot(slot: InventorySlot, predicate: OwnedMainItemPredicate): boolean {
	const item = slot.getItem();
	return slot.isPrimaryEquipment() && item !== null && predicate({
		rarity: item.rarity, level: slot.itemLevel
	});
}

/**
 * Whether a home chest slot holds a weapon or shield matching the predicate.
 */
function isMatchingChestSlot(slot: HomeChestSlot, predicate: OwnedMainItemPredicate): boolean {
	if (slot.isEmpty() || slot.itemCategory !== ItemCategory.WEAPON && slot.itemCategory !== ItemCategory.ARMOR) {
		return false;
	}
	const item = slot.getItem();
	return item !== null && predicate({
		rarity: item.rarity, level: slot.itemLevel
	});
}

/**
 * Whether the player already owns a weapon or shield matching the predicate, either equipped,
 * in their inventory reserve, or stored in their home chest.
 * @param player
 * @param predicate
 */
export async function ownsMainItemMatching(player: Player, predicate: OwnedMainItemPredicate): Promise<boolean> {
	const inventorySlots = await InventorySlots.getOfPlayer(player.id);
	if (inventorySlots.some(slot => isMatchingInventorySlot(slot, predicate))) {
		return true;
	}

	const home = await Homes.getOfPlayer(player.id);
	if (!home) {
		return false;
	}
	const chestSlots = await HomeChestSlots.getOfHome(home.id);
	return chestSlots.some(slot => isMatchingChestSlot(slot, predicate));
}
