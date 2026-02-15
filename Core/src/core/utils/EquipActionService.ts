import {
	CommandEquipActionReq, CommandEquipActionRes
} from "../../../../Lib/src/packets/commands/CommandEquipPacket";
import {
	Player, Players
} from "../database/game/models/Player";
import {
	InventorySlot, InventorySlots
} from "../database/game/models/InventorySlot";
import { InventoryInfos } from "../database/game/models/InventoryInfo";
import {
	ItemCategory, ItemConstants
} from "../../../../Lib/src/constants/ItemConstants";
import { buildEquipCategoryData } from "../../commands/player/EquipCommand";
import { Homes } from "../database/game/models/Home";
import {
	EMPTY_SLOTS_PER_CATEGORY, getSlotCountForCategory
} from "../../../../Lib/src/types/HomeFeatures";

type EquipActionResult = Omit<CommandEquipActionRes, "name">;
type EquipAction = typeof ItemConstants.EQUIP_ACTIONS[keyof typeof ItemConstants.EQUIP_ACTIONS];
type EquipError = typeof ItemConstants.EQUIP_ERRORS[keyof typeof ItemConstants.EQUIP_ERRORS];

/**
 * Handle an equip/deposit action from AsyncPacketSender.
 */
export async function handleEquipAction(
	keycloakId: string,
	packet: CommandEquipActionReq
): Promise<EquipActionResult> {
	const player = await Players.getByKeycloakId(keycloakId);
	if (!player) {
		return buildEquipActionError(ItemConstants.EQUIP_ERRORS.INVALID);
	}

	const itemCategory = packet.itemCategory as ItemCategory;
	const error = await executeEquipAction(packet.action as EquipAction, player.id, packet.slot, itemCategory);
	if (error) {
		return buildEquipActionError(error);
	}

	return buildRefreshedEquipData(player);
}

function executeEquipAction(action: EquipAction, playerId: number, slot: number, category: ItemCategory): Promise<EquipError | null> {
	switch (action) {
		case ItemConstants.EQUIP_ACTIONS.EQUIP:
			return processEquip(playerId, slot, category);
		case ItemConstants.EQUIP_ACTIONS.DEPOSIT:
			return processDeposit(playerId, category);
		default:
			return Promise.resolve(ItemConstants.EQUIP_ERRORS.INVALID);
	}
}

async function buildRefreshedEquipData(player: {
	id: number; keycloakId: string;
}): Promise<EquipActionResult> {
	const refreshedSlots = await InventorySlots.getOfPlayer(player.id);
	const inventoryInfo = await InventoryInfos.getOfPlayer(player.id);
	const home = await Homes.getOfPlayer(player.id);
	const homeBonus = home?.getLevel()?.features.inventoryBonus ?? EMPTY_SLOTS_PER_CATEGORY;
	const slotLimits = new Map<ItemCategory, number>([
		[ItemCategory.WEAPON, inventoryInfo.slotLimitForCategory(ItemCategory.WEAPON) + homeBonus.weapon],
		[ItemCategory.ARMOR, inventoryInfo.slotLimitForCategory(ItemCategory.ARMOR) + homeBonus.armor],
		[ItemCategory.POTION, inventoryInfo.slotLimitForCategory(ItemCategory.POTION) + homeBonus.potion],
		[ItemCategory.OBJECT, inventoryInfo.slotLimitForCategory(ItemCategory.OBJECT) + homeBonus.object]
	]);

	return {
		success: true,
		categories: buildEquipCategoryData(player as Player, refreshedSlots, slotLimits)
	};
}

function buildEquipActionError(error: EquipError): EquipActionResult {
	return {
		success: false,
		error,
		categories: []
	};
}

/**
 * Equip a reserve item (swap with active slot).
 */
async function processEquip(playerId: number, reserveSlot: number, category: ItemCategory): Promise<EquipError | null> {
	const inventorySlots = await InventorySlots.getOfPlayer(playerId);
	const toEquip = inventorySlots.find(s => s.itemCategory === category && s.slot === reserveSlot);
	if (!toEquip || toEquip.itemId === 0) {
		return ItemConstants.EQUIP_ERRORS.INVALID;
	}

	const activeSlot = inventorySlots.find(s => s.itemCategory === category && s.isEquipped());
	if (!activeSlot) {
		return ItemConstants.EQUIP_ERRORS.INVALID;
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
async function processDeposit(playerId: number, category: ItemCategory): Promise<EquipError | null> {
	const inventorySlots = await InventorySlots.getOfPlayer(playerId);
	const activeSlot = inventorySlots.find(s => s.itemCategory === category && s.isEquipped());
	if (!activeSlot || activeSlot.itemId === 0) {
		return ItemConstants.EQUIP_ERRORS.NO_ITEM;
	}

	const inventoryInfo = await InventoryInfos.getOfPlayer(playerId);
	const home = await Homes.getOfPlayer(playerId);
	const homeBonus = home?.getLevel()?.features.inventoryBonus;
	const bonusForCategory = homeBonus ? getSlotCountForCategory(homeBonus, category) : 0;
	const maxSlots = inventoryInfo.slotLimitForCategory(category) + bonusForCategory;
	const backupSlots = inventorySlots.filter(s => s.itemCategory === category && !s.isEquipped());

	const placeError = await placeItemInBackupSlot({
		playerId, category, source: activeSlot, backupSlots, maxSlots
	});
	if (placeError) {
		return placeError;
	}

	// Clear active slot
	activeSlot.itemId = 0;
	activeSlot.itemLevel = 0;
	activeSlot.itemEnchantmentId = null;
	await activeSlot.save();

	return null;
}

async function placeItemInBackupSlot({ playerId, category, source, backupSlots, maxSlots }: {
	playerId: number;
	category: ItemCategory;
	source: InventorySlot;
	backupSlots: InventorySlot[];
	maxSlots: number;
}): Promise<EquipError | null> {
	const emptySlot = backupSlots.find(s => s.itemId === 0);
	if (emptySlot) {
		emptySlot.itemId = source.itemId;
		emptySlot.itemLevel = source.itemLevel;
		emptySlot.itemEnchantmentId = source.itemEnchantmentId;
		await emptySlot.save();
		return null;
	}

	// maxSlots includes the equipped slot (slot 0), so backup capacity is maxSlots - 1
	if (backupSlots.length < maxSlots - 1) {
		const nextSlot = backupSlots.length > 0
			? Math.max(...backupSlots.map(s => s.slot)) + 1
			: 1;
		await InventorySlot.create({
			playerId,
			slot: nextSlot,
			itemCategory: category,
			itemId: source.itemId,
			itemLevel: source.itemLevel,
			itemEnchantmentId: source.itemEnchantmentId
		});
		return null;
	}

	return ItemConstants.EQUIP_ERRORS.RESERVE_FULL;
}
