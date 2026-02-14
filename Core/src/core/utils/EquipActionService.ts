import {
	CommandEquipActionReq, CommandEquipActionRes
} from "../../../../Lib/src/packets/commands/CommandEquipPacket";
import { Players } from "../database/game/models/Player";
import {
	InventorySlot, InventorySlots
} from "../database/game/models/InventorySlot";
import { InventoryInfos } from "../database/game/models/InventoryInfo";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { buildEquipCategoryData } from "../../commands/player/EquipCommand";
import { Homes } from "../database/game/models/Home";

/**
 * Handle an equip/deposit action from AsyncPacketSender.
 */
export async function handleEquipAction(
	keycloakId: string,
	packet: CommandEquipActionReq
): Promise<Omit<CommandEquipActionRes, "name">> {
	const player = await Players.getByKeycloakId(keycloakId);
	if (!player) {
		return buildEquipActionError("invalid");
	}

	const itemCategory = packet.itemCategory as ItemCategory;

	if (packet.action === "equip") {
		const error = await processEquip(player.id, packet.slot, itemCategory);
		if (error) {
			return buildEquipActionError(error);
		}
	}
	else if (packet.action === "deposit") {
		const error = await processDeposit(player.id, itemCategory);
		if (error) {
			return buildEquipActionError(error);
		}
	}
	else {
		return buildEquipActionError("invalid");
	}

	// Refresh inventory data
	const refreshedSlots = await InventorySlots.getOfPlayer(player.id);
	const inventoryInfo = await InventoryInfos.getOfPlayer(player.id);
	const home = await Homes.getOfPlayer(player.id);
	const homeBonus = home?.getLevel()?.features.inventoryBonus ?? {
		weapon: 0, armor: 0, potion: 0, object: 0
	};
	const slotLimits = new Map<ItemCategory, number>([
		[ItemCategory.WEAPON, inventoryInfo.slotLimitForCategory(ItemCategory.WEAPON) + homeBonus.weapon],
		[ItemCategory.ARMOR, inventoryInfo.slotLimitForCategory(ItemCategory.ARMOR) + homeBonus.armor],
		[ItemCategory.POTION, inventoryInfo.slotLimitForCategory(ItemCategory.POTION) + homeBonus.potion],
		[ItemCategory.OBJECT, inventoryInfo.slotLimitForCategory(ItemCategory.OBJECT) + homeBonus.object]
	]);

	return {
		success: true,
		categories: buildEquipCategoryData(player, refreshedSlots, slotLimits)
	};
}

function buildEquipActionError(error: string): Omit<CommandEquipActionRes, "name"> {
	return {
		success: false,
		error,
		categories: []
	};
}

/**
 * Equip a reserve item (swap with active slot).
 */
async function processEquip(playerId: number, reserveSlot: number, category: ItemCategory): Promise<string | null> {
	const inventorySlots = await InventorySlots.getOfPlayer(playerId);
	const toEquip = inventorySlots.find(s => s.itemCategory === category && s.slot === reserveSlot);
	if (!toEquip || toEquip.itemId === 0) {
		return "invalid";
	}

	const activeSlot = inventorySlots.find(s => s.itemCategory === category && s.isEquipped());
	if (!activeSlot) {
		return "invalid";
	}

	// If active slot is empty (id=0), just move the reserve item and destroy the reserve slot
	if (activeSlot.itemId === 0) {
		activeSlot.itemId = toEquip.itemId;
		activeSlot.itemLevel = toEquip.itemLevel;
		activeSlot.itemEnchantmentId = toEquip.itemEnchantmentId;
		await activeSlot.save();
		await toEquip.destroy();
	}
	else {
		// Swap: exchange data between active and reserve slots
		const tempId = activeSlot.itemId;
		const tempLevel = activeSlot.itemLevel;
		const tempEnchantment = activeSlot.itemEnchantmentId;

		activeSlot.itemId = toEquip.itemId;
		activeSlot.itemLevel = toEquip.itemLevel;
		activeSlot.itemEnchantmentId = toEquip.itemEnchantmentId;

		toEquip.itemId = tempId;
		toEquip.itemLevel = tempLevel;
		toEquip.itemEnchantmentId = tempEnchantment;

		await activeSlot.save();
		await toEquip.save();
	}

	return null;
}

/**
 * Deposit the active item to reserve.
 */
async function processDeposit(playerId: number, category: ItemCategory): Promise<string | null> {
	const inventorySlots = await InventorySlots.getOfPlayer(playerId);
	const activeSlot = inventorySlots.find(s => s.itemCategory === category && s.isEquipped());
	if (!activeSlot || activeSlot.itemId === 0) {
		return "noItem";
	}

	const inventoryInfo = await InventoryInfos.getOfPlayer(playerId);
	const home = await Homes.getOfPlayer(playerId);
	const homeBonus = home?.getLevel()?.features.inventoryBonus;
	const bonusForCategory = homeBonus?.[category === ItemCategory.WEAPON
		? "weapon"
		: category === ItemCategory.ARMOR
			? "armor"
			: category === ItemCategory.POTION ? "potion" : "object"] ?? 0;
	const maxSlots = inventoryInfo.slotLimitForCategory(category) + bonusForCategory;
	const backupSlots = inventorySlots.filter(s => s.itemCategory === category && !s.isEquipped());

	// Find an empty backup slot
	const emptySlot = backupSlots.find(s => s.itemId === 0);
	if (emptySlot) {
		emptySlot.itemId = activeSlot.itemId;
		emptySlot.itemLevel = activeSlot.itemLevel;
		emptySlot.itemEnchantmentId = activeSlot.itemEnchantmentId;
		await emptySlot.save();
	}
	else if (backupSlots.length < maxSlots) {
		const nextSlot = backupSlots.length > 0
			? Math.max(...backupSlots.map(s => s.slot)) + 1
			: 1;
		await InventorySlot.create({
			playerId,
			slot: nextSlot,
			itemCategory: category,
			itemId: activeSlot.itemId,
			itemLevel: activeSlot.itemLevel,
			itemEnchantmentId: activeSlot.itemEnchantmentId
		});
	}
	else {
		return "reserveFull";
	}

	// Clear active slot
	activeSlot.itemId = 0;
	activeSlot.itemLevel = 0;
	activeSlot.itemEnchantmentId = null;
	await activeSlot.save();

	return null;
}
