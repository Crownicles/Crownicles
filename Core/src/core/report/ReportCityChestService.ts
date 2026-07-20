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
	CommandReportHomeChestActionReq,
	CommandReportHomeChestActionRes,
	ChestError,
	ChestAction
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { HomeConstants } from "../../../../Lib/src/constants/HomeConstants";
import {
	HomeChestSlot, HomeChestSlots
} from "../database/game/models/HomeChestSlot";
import InventoryInfo from "../database/game/models/InventoryInfo";
import {
	buildChestData, buildUpgradeStationData
} from "./ReportCityService";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { MissionsController } from "../missions/MissionsController";
import { updateHaveItemRarityMission } from "../utils/ItemUtils";
import {
	clearItemSlotData, copyItemSlotData, findFirstFreeBackupSlot, ItemSlotData
} from "../utils/ItemSlotUtils";
import { Materials } from "../database/game/models/Material";

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

/**
 * Whether a chest action brings an item (potentially of higher rarity) back
 * into the player's inventory, requiring the "have an item of a given rarity"
 * mission to be re-evaluated.
 */
function actionBringsItemToInventory(action: ChestAction): boolean {
	return action === HomeConstants.CHEST_ACTIONS.WITHDRAW || action === HomeConstants.CHEST_ACTIONS.SWAP;
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

async function placeItemInBackupSlot(backupSlots: InventorySlot[], item: ItemSlotData): Promise<boolean> {
	const emptyBackupSlot = backupSlots.find(slot => slot.itemId === 0);
	if (!emptyBackupSlot) {
		return false;
	}

	await assignItemToSlotUnderLock(emptyBackupSlot, item);
	return true;
}

async function createBackupSlot(player: Player, itemCategory: ItemCategory, item: ItemSlotData, slot: number): Promise<void> {
	await InventorySlot.create({
		playerId: player.id,
		slot,
		itemCategory,
		itemId: item.itemId,
		itemLevel: item.itemLevel,
		itemEnchantmentId: item.itemEnchantmentId,
		remainingPotionUsages: item.remainingPotionUsages
	});
}

/**
 * Handle a chest action request (deposit/withdraw) sent directly from Discord via AsyncPacketSender.
 * Returns refreshed chest data for the Discord side to update the view in-place.
 *
 * The mutation is performed under a Player + Home row-level lock so that
 * concurrent chest packets (e.g. fast button mashing) cannot double-move an
 * item and duplicate or lose inventory / chest slots (review checklist §10).
 */
export async function handleChestAction(
	keycloakId: string,
	packet: CommandReportHomeChestActionReq,
	response: CrowniclesPacket[]
): Promise<ChestActionResult> {
	const player = await Players.getByKeycloakId(keycloakId);
	const home = player ? await Homes.getOfPlayer(player.id) : null;
	const chestActionContext = {
		player,
		home
	};

	if (!hasChestActionContext(chestActionContext)) {
		response.push(makePacket(CommandReportHomeChestActionRes, INVALID_CHEST_ACTION));
		return INVALID_CHEST_ACTION;
	}

	const result = await withLockedEntities(
		[Player.lockKey(chestActionContext.player.id), Home.lockKey(chestActionContext.home.id)] as const,
		([lockedPlayer, lockedHome]) => runChestActionUnderLock(packet, lockedPlayer, lockedHome)
	);

	/*
	 * Push the chest action response packet BEFORE any mission notification
	 * packet. The Discord async packet sender matches the first response
	 * packet carrying the request's packetId to the awaiting callback, so a
	 * mission-completed packet pushed first would hijack that callback and
	 * leave the chest response unhandled (broken message). See issue #4342.
	 */
	response.push(makePacket(CommandReportHomeChestActionRes, result));

	/*
	 * Trigger the mission update only after the Player + Home locks are
	 * released: `MissionsController.update` additionally locks
	 * `player_missions_info` then `players`, which would invert the
	 * already-held `players` lock and risk a deadlock.
	 */
	if (result.success && packet.action === HomeConstants.CHEST_ACTIONS.DEPOSIT) {
		await MissionsController.update(chestActionContext.player, response, { missionId: "depositChestItem" });
	}

	/*
	 * Withdrawing or swapping brings an item (potentially of higher rarity) back
	 * into the inventory, so re-evaluate the "have an item of a given rarity"
	 * mission against the player's best owned item. See issue #4393.
	 */
	if (result.success && actionBringsItemToInventory(packet.action)) {
		await updateHaveItemRarityMission(chestActionContext.player, response);
	}
	return result;
}

async function runChestActionUnderLock(
	packet: CommandReportHomeChestActionReq,
	player: Player,
	home: Home
): Promise<ChestActionResult> {
	const homeLevel = home.getLevel();
	if (homeLevel === null) {
		return INVALID_CHEST_ACTION;
	}

	const error = await executeChestAction(packet, player, home);
	if (error) {
		return buildChestActionError(error);
	}

	// Build refreshed chest data
	const playerInventory = await InventorySlots.getOfPlayer(player.id);
	const refreshedData = await buildChestData(home, homeLevel, playerInventory, player);
	const playerMaterials = await Materials.getPlayerMaterials(player.id);
	const playerMaterialMap = new Map(playerMaterials.map(material => [material.materialId, material.quantity]));

	return {
		success: true,
		chestItems: refreshedData.chestItems,
		depositableItems: refreshedData.depositableItems,
		slotsPerCategory: refreshedData.slotsPerCategory,
		inventoryCapacity: refreshedData.inventoryCapacity,
		upgradeStation: buildUpgradeStationData(playerInventory, playerMaterialMap, homeLevel, player)
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
	await assignItemToSlotUnderLock(emptyChestSlot, slot);

	// Clear inventory slot
	await clearInventorySlotUnderLock(slot);

	return null;
}

/**
 * Clear an inventory slot after depositing/moving its item.
 * Active slots are reset, backup slots are destroyed.
 */
async function clearInventorySlotUnderLock(slot: InventorySlot): Promise<void> {
	if (slot.slot === 0) {
		clearItemSlotData(slot);
		await slot.save();
	}
	else {
		await slot.destroy();
	}
}

async function clearChestSlotUnderLock(chestSlot: HomeChestSlot): Promise<void> {
	clearItemSlotData(chestSlot);
	await chestSlot.save();
}

type SaveableItemSlot = ItemSlotData & {
	save(): Promise<unknown>;
};

async function assignItemToSlotUnderLock(slot: SaveableItemSlot, item: ItemSlotData): Promise<void> {
	copyItemSlotData(slot, item);
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
	item: ItemSlotData
): Promise<ChestError | null> {
	const playerInventory = await InventorySlots.getOfPlayer(player.id);

	const activeSlot = findEmptyActiveSlot(playerInventory, itemCategory);
	if (activeSlot) {
		await assignItemToSlotUnderLock(activeSlot, item);
		return null;
	}

	const backupSlots = getBackupSlots(playerInventory, itemCategory);
	if (await placeItemInBackupSlot(backupSlots, item)) {
		return null;
	}

	const maxSlots = await getBackupInventoryCapacity(player, home, itemCategory);
	const freeSlot = findFirstFreeBackupSlot(backupSlots, maxSlots);
	if (freeSlot !== null) {
		await createBackupSlot(player, itemCategory, item, freeSlot);
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
		itemLevel: chestSlot.itemLevel,
		itemEnchantmentId: chestSlot.itemEnchantmentId,
		remainingPotionUsages: chestSlot.remainingPotionUsages
	});

	if (error) {
		return error;
	}

	// Clear the chest slot
	await clearChestSlotUnderLock(chestSlot);

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
	const temp: ItemSlotData = {
		itemId: inventorySlot.itemId,
		itemLevel: inventorySlot.itemLevel,
		itemEnchantmentId: inventorySlot.itemEnchantmentId,
		remainingPotionUsages: inventorySlot.remainingPotionUsages
	};
	await assignItemToSlotUnderLock(inventorySlot, chestSlot);
	await assignItemToSlotUnderLock(chestSlot, temp);

	return null;
}
