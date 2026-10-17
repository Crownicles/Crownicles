import InventorySlot, { InventorySlots } from "../database/game/models/InventorySlot";
import { Player } from "../database/game/models/Player";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandReportEquipmentChangedRes } from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { Locked } from "../../../../Lib/src/locks/withLockedEntities";
import { MainItemDetails } from "../../../../Lib/src/types/MainItemDetails";

/**
 * A city-menu reaction targeting one of the player's equipment slots
 */
export type EquipmentSlotReaction = {
	slot: number;
	itemCategory: number;
};

export async function findInventorySlotForReaction(playerId: number, reaction: EquipmentSlotReaction): Promise<InventorySlot | undefined> {
	const slots = await InventorySlots.getOfPlayer(playerId);
	return slots.find(slot => slot.slot === reaction.slot && slot.itemCategory === reaction.itemCategory);
}

/**
 * The slot targeted by a city-menu reaction, provided it still holds the equipment the menu was built for.
 * The chest or an inventory switch may have moved another equipment there since, and the listed prices
 * and levels would then apply to it.
 */
export async function getListedInventorySlotUnderLock(
	lockedPlayer: Locked<Player>,
	reaction: EquipmentSlotReaction,
	listedItem: MainItemDetails,
	response: CrowniclesPacket[]
): Promise<InventorySlot | null> {
	const inventorySlot = await findInventorySlotForReaction(lockedPlayer.id, reaction);
	if (!inventorySlot?.holdsItem(listedItem)) {
		response.push(makePacket(CommandReportEquipmentChangedRes, {}));
		return null;
	}
	return inventorySlot;
}

/**
 * Remove the enchantment of the listed equipment, shared by every city service that disenchants.
 * Returns false, with the equipment-changed response, when the slot no longer holds the listed equipment.
 */
export async function removeListedEnchantmentUnderLock(
	lockedPlayer: Locked<Player>,
	reaction: EquipmentSlotReaction,
	listedItem: MainItemDetails,
	response: CrowniclesPacket[]
): Promise<boolean> {
	const inventorySlot = await getListedInventorySlotUnderLock(lockedPlayer, reaction, listedItem, response);
	if (!inventorySlot) {
		return false;
	}
	inventorySlot.itemEnchantmentId = null;
	await inventorySlot.save();
	return true;
}
