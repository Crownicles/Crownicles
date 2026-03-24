import InventorySlot, { InventorySlots } from "../database/game/models/InventorySlot";
import {
	Player,
	Players
} from "../database/game/models/Player";
import {
	Home, Homes
} from "../database/game/models/Home";
import {
	EMPTY_SLOTS_PER_CATEGORY, getSlotCountForCategory
} from "../../../../Lib/src/types/HomeFeatures";
import {
	ItemLevel
} from "../../../../Lib/src/constants/BlacksmithConstants";
import {
	CommandReportHomeChestActionReq,
	CommandReportHomeChestActionRes,
	ChestError
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { HomeConstants } from "../../../../Lib/src/constants/HomeConstants";
import {
	HomeChestSlot, HomeChestSlots
} from "../database/game/models/HomeChestSlot";
import InventoryInfo from "../database/game/models/InventoryInfo";
import { buildChestData } from "./ReportCityService";

type ChestActionResult = Omit<CommandReportHomeChestActionRes, "name">;

type PlayerInventory = Awaited<ReturnType<typeof InventorySlots.getOfPlayer>>;

function buildChestActionError(error: ChestError): ChestActionResult {
	return {
		success: false,
		error,
		chestItems: [],
		depositableItems: [],
		slotsPerCategory: EMPTY_SLOTS_PER_CATEGORY,
		inventoryCapacity: EMPTY_SLOTS_PER_CATEGORY
	};
}

const INVALID_CHEST_ACTION = buildChestActionError(HomeConstants.CHEST_ERRORS.INVALID);

function hasChestActionContext(params: {
	player: Player | null;
	home: Home | null;
}): params is {
	player: Player;
	home: Home;
} {
	return params.player !== null && params.home !== null && params.home.getLevel() !== null;
}

function findEmptyActiveSlot(playerInventory: PlayerInventory, itemCategory: ItemCategory): InventorySlot | undefined {
	return playerInventory.find(slot => slot.itemCategory === itemCategory && slot.slot === 0 && slot.itemId === 0);
}

function getBackupSlots(playerInventory: PlayerInventory, itemCategory: ItemCategory): InventorySlot[] {
	return playerInventory.filter(slot => slot.itemCategory === itemCategory && slot.slot > 0);
}

async function getBackupInventoryCapacity(player: Player, home: Home, itemCategory: ItemCategory): Promise<number> {
	const inventoryInfo = await InventoryInfo.findOne({ where: { playerId: player.id } });
	const homeBonus = home.getLevel()?.features.inventoryBonus;
	const bonusForCategory = homeBonus ? getSlotCountForCategory(homeBonus, itemCategory) : 0;
	return inventoryInfo ? inventoryInfo.slotLimitForCategory(itemCategory) + bonusForCategory : 1;
}

async function placeItemInBackupSlot(backupSlots: InventorySlot[], item: ItemPlacement): Promise<boolean> {
	const emptyBackupSlot = backupSlots.find(slot => slot.itemId === 0);
	if (!emptyBackupSlot) {
		return false;
	}

	await assignItemToSlot(emptyBackupSlot, item);
	return true;
}

async function createBackupSlot(player: Player, itemCategory: ItemCategory, item: ItemPlacement, backupSlots: InventorySlot[]): Promise<void> {
	const nextSlot = backupSlots.length > 0 ? Math.max(...backupSlots.map(slot => slot.slot)) + 1 : 1;
	await InventorySlot.create({
		playerId: player.id,
		slot: nextSlot,
		itemCategory,
		itemId: item.itemId,
		itemLevel: item.itemLevel,
		itemEnchantmentId: item.itemEnchantmentId
	});
}

/**
 * Handle a chest action request (deposit/withdraw) sent directly from Discord via AsyncPacketSender.
 * Returns refreshed chest data for the Discord side to update the view in-place.
 */
export async function handleChestAction(
	keycloakId: string,
	packet: CommandReportHomeChestActionReq
): Promise<ChestActionResult> {
	const player = await Players.getByKeycloakId(keycloakId);
	const home = player ? await Homes.getOfPlayer(player.id) : null;
	const chestActionContext = {
		player,
		home
	};

	if (!hasChestActionContext(chestActionContext)) {
		return INVALID_CHEST_ACTION;
	}

	const {
		player: validPlayer,
		home: validHome
	} = chestActionContext;

	const error = await executeChestAction(packet, validPlayer, validHome);
	if (error) {
		return buildChestActionError(error);
	}

	// Build refreshed chest data
	const playerInventory = await InventorySlots.getOfPlayer(validPlayer.id);
	const refreshedData = await buildChestData(validHome, validHome.getLevel()!, playerInventory, validPlayer);

	return {
		success: true,
		chestItems: refreshedData.chestItems,
		depositableItems: refreshedData.depositableItems,
		slotsPerCategory: refreshedData.slotsPerCategory,
		inventoryCapacity: refreshedData.inventoryCapacity
	};
}

function executeChestAction(
	packet: CommandReportHomeChestActionReq,
	player: Player,
	home: Home
): Promise<ChestError | null> {
	const itemCategory = packet.itemCategory as ItemCategory;

	switch (packet.action) {
		case HomeConstants.CHEST_ACTIONS.DEPOSIT:
			return processChestDeposit(player, home, packet.slot, itemCategory);
		case HomeConstants.CHEST_ACTIONS.WITHDRAW:
			return processChestWithdraw(player, home, packet.slot, itemCategory);
		case HomeConstants.CHEST_ACTIONS.SWAP:
			return processChestSwap({
				player,
				home,
				inventorySlotNumber: packet.slot,
				chestSlotNumber: packet.chestSlot,
				itemCategory
			});
		default:
			return Promise.resolve(HomeConstants.CHEST_ERRORS.INVALID);
	}
}

async function processChestDeposit(
	player: Player,
	home: Home,
	inventorySlot: number,
	itemCategory: ItemCategory
): Promise<ChestError | null> {
	const slot = await InventorySlots.getItem(player.id, inventorySlot, itemCategory);
	if (!slot || slot.itemId === 0) {
		return HomeConstants.CHEST_ERRORS.INVALID;
	}

	const emptyChestSlot = await HomeChestSlots.findEmptySlot(home.id, itemCategory);
	if (!emptyChestSlot) {
		return HomeConstants.CHEST_ERRORS.CHEST_FULL;
	}

	// Move item to chest
	await assignItemToSlot(emptyChestSlot, slot);

	// Clear inventory slot
	await clearInventorySlot(slot);

	return null;
}

/**
 * Clear an inventory slot after depositing/moving its item.
 * Active slots are reset, backup slots are destroyed.
 */
async function clearInventorySlot(slot: InventorySlot): Promise<void> {
	if (slot.slot === 0) {
		resetItemFields(slot);
		await slot.save();
	}
	else {
		await slot.destroy();
	}
}

async function clearChestSlot(chestSlot: HomeChestSlot): Promise<void> {
	resetItemFields(chestSlot);
	await chestSlot.save();
}

/**
 * Reset item-related fields on any slot-like entity.
 */
function resetItemFields(target: {
	itemId: number; itemLevel: number; itemEnchantmentId: string | null;
}): void {
	target.itemId = 0;
	target.itemLevel = 0;
	target.itemEnchantmentId = null;
}

/**
 * Item data to be placed in an inventory slot.
 */
interface ItemPlacement {
	itemId: number;
	itemLevel: ItemLevel;
	itemEnchantmentId: string | null;
}

type SaveableItemSlot = {
	itemId: number;
	itemLevel: number;
	itemEnchantmentId: string | null;
	save(): Promise<unknown>;
};

async function assignItemToSlot(slot: SaveableItemSlot, item: ItemPlacement): Promise<void> {
	slot.itemId = item.itemId;
	slot.itemLevel = item.itemLevel;
	slot.itemEnchantmentId = item.itemEnchantmentId;
	await slot.save();
}

/**
 * Attempt to place an item in the player's inventory.
 * Returns null on success, HomeConstants.CHEST_ERRORS.INVENTORY_FULL if no space.
 */
async function placeItemInInventory(
	player: Player,
	home: Home,
	itemCategory: ItemCategory,
	item: ItemPlacement
): Promise<ChestError | null> {
	const playerInventory = await InventorySlots.getOfPlayer(player.id);

	const activeSlot = findEmptyActiveSlot(playerInventory, itemCategory);
	if (activeSlot) {
		await assignItemToSlot(activeSlot, item);
		return null;
	}

	const backupSlots = getBackupSlots(playerInventory, itemCategory);
	if (await placeItemInBackupSlot(backupSlots, item)) {
		return null;
	}

	const maxSlots = await getBackupInventoryCapacity(player, home, itemCategory);
	if (backupSlots.length < maxSlots - 1) {
		await createBackupSlot(player, itemCategory, item, backupSlots);
		return null;
	}

	return HomeConstants.CHEST_ERRORS.INVENTORY_FULL;
}

async function processChestWithdraw(
	player: Player,
	home: Home,
	chestSlotNumber: number,
	itemCategory: ItemCategory
): Promise<ChestError | null> {
	const chestSlot = await HomeChestSlots.getSlot(home.id, chestSlotNumber, itemCategory);
	if (!chestSlot || chestSlot.itemId === 0) {
		return HomeConstants.CHEST_ERRORS.INVALID;
	}

	const error = await placeItemInInventory(player, home, itemCategory, {
		itemId: chestSlot.itemId,
		itemLevel: chestSlot.itemLevel as ItemLevel,
		itemEnchantmentId: chestSlot.itemEnchantmentId
	});

	if (error) {
		return error;
	}

	// Clear the chest slot
	await clearChestSlot(chestSlot);

	return null;
}

interface ChestSwapParams {
	player: Player;
	home: Home;
	inventorySlotNumber: number;
	chestSlotNumber: number;
	itemCategory: ItemCategory;
}

async function processChestSwap({
	player,
	home,
	inventorySlotNumber,
	chestSlotNumber,
	itemCategory
}: ChestSwapParams): Promise<ChestError | null> {
	const inventorySlot = await InventorySlots.getItem(player.id, inventorySlotNumber, itemCategory);
	if (!inventorySlot || inventorySlot.itemId === 0) {
		return HomeConstants.CHEST_ERRORS.INVALID;
	}

	const chestSlot = await HomeChestSlots.getSlot(home.id, chestSlotNumber, itemCategory);
	if (!chestSlot || chestSlot.itemId === 0) {
		return HomeConstants.CHEST_ERRORS.INVALID;
	}

	// Swap: exchange items between inventory slot and chest slot
	const temp: ItemPlacement = {
		itemId: inventorySlot.itemId,
		itemLevel: inventorySlot.itemLevel as ItemLevel,
		itemEnchantmentId: inventorySlot.itemEnchantmentId
	};
	await assignItemToSlot(inventorySlot, chestSlot);
	await assignItemToSlot(chestSlot, temp);

	return null;
}
