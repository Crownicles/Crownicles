import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/core/database/game/models/Player", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/Player")>(),
	Players: { getByKeycloakId: vi.fn() }
}));
vi.mock("../../../src/core/database/game/models/Home", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/Home")>(),
	Homes: { getOfPlayer: vi.fn() }
}));
vi.mock("../../../src/core/database/game/models/InventorySlot", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/InventorySlot")>(),
	InventorySlots: {
		getItem: vi.fn(), getOfPlayer: vi.fn()
	}
}));
vi.mock("../../../src/core/database/game/models/HomeChestSlot", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/HomeChestSlot")>(),
	HomeChestSlots: {
		findEmptySlot: vi.fn(), getSlot: vi.fn()
	}
}));
vi.mock("../../../src/core/report/ReportCityService", () => ({
	buildChestData: vi.fn()
}));
vi.mock("../../../../Lib/src/locks/withLockedEntities", () => ({
	withLockedEntities: vi.fn()
}));
vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn().mockResolvedValue(undefined) }
}));
vi.mock("../../../src/core/utils/ItemUtils", () => ({
	updateHaveItemRarityMission: vi.fn().mockResolvedValue(undefined)
}));

import { handleChestAction } from "../../../src/core/report/ReportCityChestService";
import {
	Player, Players
} from "../../../src/core/database/game/models/Player";
import {
	Home, Homes
} from "../../../src/core/database/game/models/Home";
import InventorySlot, { InventorySlots } from "../../../src/core/database/game/models/InventorySlot";
import {
	HomeChestSlot, HomeChestSlots
} from "../../../src/core/database/game/models/HomeChestSlot";
import InventoryInfo from "../../../src/core/database/game/models/InventoryInfo";
import { buildChestData } from "../../../src/core/report/ReportCityService";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { updateHaveItemRarityMission } from "../../../src/core/utils/ItemUtils";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { HomeConstants } from "../../../../Lib/src/constants/HomeConstants";
import { HomeLevel } from "../../../../Lib/src/types/HomeLevel";
import { EMPTY_SLOTS_PER_CATEGORY } from "../../../../Lib/src/types/HomeFeatures";
import {
	ChestAction, CommandReportHomeChestActionReq
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { ItemSlotData } from "../../../src/core/utils/ItemSlotUtils";
import {
	asPlayer, lockedEntitiesOf, makeHandlerPlayer
} from "./CityHandlerFixture";

const KEYCLOAK_ID = "chest-player";
const HOME_ID = 3;
const STORED_ITEM: ItemSlotData = {
	itemId: 11, itemLevel: 2, itemEnchantmentId: "pveAttack1", remainingPotionUsages: null
};
const CARRIED_ITEM: ItemSlotData = {
	itemId: 2, itemLevel: 1, itemEnchantmentId: null, remainingPotionUsages: null
};
const EMPTY_ITEM: ItemSlotData = {
	itemId: 0, itemLevel: 0, itemEnchantmentId: null, remainingPotionUsages: null
};
const REFRESHED_CHEST: Awaited<ReturnType<typeof buildChestData>> = {
	chestItems: [],
	depositableItems: [],
	slotsPerCategory: HomeLevel.LEVEL_4.features.chestSlots,
	inventoryCapacity: EMPTY_SLOTS_PER_CATEGORY
};

type Saveable = {
	save: ReturnType<typeof vi.fn>;
	destroy: ReturnType<typeof vi.fn>;
};

function inventorySlot(slot: number, item: ItemSlotData): InventorySlot & Saveable {
	return Object.assign(Object.create(InventorySlot.prototype) as InventorySlot, {
		playerId: 1, slot, itemCategory: ItemCategory.WEAPON, ...item, save: vi.fn().mockResolvedValue(undefined), destroy: vi.fn().mockResolvedValue(undefined)
	});
}

function emptyArmorSlot(slot: number): InventorySlot & Saveable {
	return Object.assign(inventorySlot(slot, EMPTY_ITEM), { itemCategory: ItemCategory.ARMOR });
}

function chestSlot(slot: number, item: ItemSlotData): HomeChestSlot & Saveable {
	return Object.assign(Object.create(HomeChestSlot.prototype) as HomeChestSlot, {
		homeId: HOME_ID, slot, itemCategory: ItemCategory.WEAPON, ...item, save: vi.fn().mockResolvedValue(undefined), destroy: vi.fn()
	});
}

function itemOf(slot: ItemSlotData): ItemSlotData {
	return {
		itemId: slot.itemId, itemLevel: slot.itemLevel, itemEnchantmentId: slot.itemEnchantmentId, remainingPotionUsages: slot.remainingPotionUsages
	};
}

function makeHome(level = 4): Home {
	return Object.assign(Object.create(Home.prototype) as Home, {
		id: HOME_ID, ownerId: 1, cityId: "boug_coton", level
	});
}

async function act(action: ChestAction, slot: number, chestSlotNumber = -1): Promise<{
	result: Awaited<ReturnType<typeof handleChestAction>>;
	response: CrowniclesPacket[];
}> {
	const response: CrowniclesPacket[] = [];
	const packet: CommandReportHomeChestActionReq = {
		action, slot, itemCategory: ItemCategory.WEAPON, chestSlot: chestSlotNumber
	};
	const result = await handleChestAction(KEYCLOAK_ID, packet, response);
	return {
		result, response
	};
}

function giveInventoryInfo(weaponSlots: number): void {
	vi.spyOn(InventoryInfo, "findOne").mockResolvedValue(Object.assign(Object.create(InventoryInfo.prototype) as InventoryInfo, {
		weaponSlots, armorSlots: 1, potionSlots: 1, objectSlots: 1
	}));
}

const player = makeHandlerPlayer(0);
let home: Home;

beforeEach(() => {
	vi.clearAllMocks();
	home = makeHome();
	vi.mocked(Players.getByKeycloakId).mockResolvedValue(asPlayer(player));
	vi.mocked(Homes.getOfPlayer).mockResolvedValue(home);
	vi.mocked(buildChestData).mockResolvedValue(REFRESHED_CHEST);
	vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([]);
	giveInventoryInfo(1);
	const resolve = lockedEntitiesOf([[Player, player.id, player], [Home, HOME_ID, home]]);
	vi.mocked(withLockedEntities).mockImplementation((keys, callback) => callback(resolve(keys) as never));
});

describe("handleChestAction context", () => {
	it("refuses a player without home, an unknown player and a home of an unknown level, without locking", async () => {
		vi.mocked(Homes.getOfPlayer).mockResolvedValueOnce(null);
		const homeless = await act(HomeConstants.CHEST_ACTIONS.DEPOSIT, 0);
		vi.mocked(Homes.getOfPlayer).mockResolvedValueOnce(makeHome(99));
		const brokenHome = await act(HomeConstants.CHEST_ACTIONS.DEPOSIT, 0);
		vi.mocked(Players.getByKeycloakId).mockResolvedValueOnce(null);
		const unknown = await act(HomeConstants.CHEST_ACTIONS.DEPOSIT, 0);

		for (const { result, response } of [homeless, brokenHome, unknown]) {
			expect(result).toMatchObject({
				success: false, error: HomeConstants.CHEST_ERRORS.INVALID, chestItems: [], depositableItems: []
			});
			expect(response.map(packet => packet.constructor.name)).toEqual(["CommandReportHomeChestActionRes"]);
		}
		expect(withLockedEntities).not.toHaveBeenCalled();
	});

	it("refuses an unknown action", async () => {
		const { result } = await act("burn" as ChestAction, 0);

		expect(result.error).toBe(HomeConstants.CHEST_ERRORS.INVALID);
		expect(MissionsController.update).not.toHaveBeenCalled();
	});
});

describe("deposit", () => {
	it("moves the equipped item into the first empty chest slot, empties the active slot and answers before the mission", async () => {
		const carried = inventorySlot(0, CARRIED_ITEM);
		const target = chestSlot(2, EMPTY_ITEM);
		vi.mocked(InventorySlots.getItem).mockResolvedValue(carried);
		vi.mocked(HomeChestSlots.findEmptySlot).mockResolvedValue(target);

		const { result, response } = await act(HomeConstants.CHEST_ACTIONS.DEPOSIT, 0);

		expect(InventorySlots.getItem).toHaveBeenCalledWith(player.id, 0, ItemCategory.WEAPON);
		expect(HomeChestSlots.findEmptySlot).toHaveBeenCalledWith(HOME_ID, ItemCategory.WEAPON);
		expect(itemOf(target)).toEqual(CARRIED_ITEM);
		expect(target.save).toHaveBeenCalled();
		expect(itemOf(carried)).toEqual(EMPTY_ITEM);
		expect(carried.save).toHaveBeenCalled();
		expect(carried.destroy).not.toHaveBeenCalled();
		expect(result).toEqual({
			success: true, ...REFRESHED_CHEST
		});
		expect(buildChestData).toHaveBeenCalledWith(home, HomeLevel.LEVEL_4, [], player);
		expect(response[0].constructor.name).toBe("CommandReportHomeChestActionRes");
		expect(MissionsController.update).toHaveBeenCalledWith(player, response, { missionId: "depositChestItem" });
		expect(updateHaveItemRarityMission).not.toHaveBeenCalled();
	});

	it("deletes a backup slot once its item is in the chest", async () => {
		const backup = inventorySlot(2, CARRIED_ITEM);
		vi.mocked(InventorySlots.getItem).mockResolvedValue(backup);
		vi.mocked(HomeChestSlots.findEmptySlot).mockResolvedValue(chestSlot(1, EMPTY_ITEM));

		await act(HomeConstants.CHEST_ACTIONS.DEPOSIT, 2);

		expect(backup.destroy).toHaveBeenCalled();
		expect(backup.save).not.toHaveBeenCalled();
	});

	it("refuses an empty slot and a full chest without moving anything", async () => {
		vi.mocked(InventorySlots.getItem).mockResolvedValueOnce(inventorySlot(0, EMPTY_ITEM));
		const empty = await act(HomeConstants.CHEST_ACTIONS.DEPOSIT, 0);
		vi.mocked(InventorySlots.getItem).mockResolvedValueOnce(null);
		const missing = await act(HomeConstants.CHEST_ACTIONS.DEPOSIT, 0);
		const carried = inventorySlot(0, CARRIED_ITEM);
		vi.mocked(InventorySlots.getItem).mockResolvedValueOnce(carried);
		vi.mocked(HomeChestSlots.findEmptySlot).mockResolvedValueOnce(null);
		const full = await act(HomeConstants.CHEST_ACTIONS.DEPOSIT, 0);

		expect([empty.result.error, missing.result.error, full.result.error]).toEqual([
			HomeConstants.CHEST_ERRORS.INVALID, HomeConstants.CHEST_ERRORS.INVALID, HomeConstants.CHEST_ERRORS.CHEST_FULL
		]);
		expect(full.result.success).toBe(false);
		expect(itemOf(carried)).toEqual(CARRIED_ITEM);
		expect(carried.save).not.toHaveBeenCalled();
		expect(MissionsController.update).not.toHaveBeenCalled();
	});
});

describe("withdraw", () => {
	it("puts the item in the empty active slot, empties the chest slot and re-evaluates the item rarity mission", async () => {
		const stored = chestSlot(1, STORED_ITEM);
		const active = inventorySlot(0, EMPTY_ITEM);
		const emptyBackup = inventorySlot(1, EMPTY_ITEM);
		vi.mocked(HomeChestSlots.getSlot).mockResolvedValue(stored);
		vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([emptyArmorSlot(0), emptyBackup, active]);

		const { result, response } = await act(HomeConstants.CHEST_ACTIONS.WITHDRAW, 1);

		expect(HomeChestSlots.getSlot).toHaveBeenCalledWith(HOME_ID, 1, ItemCategory.WEAPON);
		expect(result.success).toBe(true);
		expect(itemOf(active)).toEqual(STORED_ITEM);
		expect(active.save).toHaveBeenCalled();
		expect(itemOf(emptyBackup)).toEqual(EMPTY_ITEM);
		expect(itemOf(stored)).toEqual(EMPTY_ITEM);
		expect(stored.save).toHaveBeenCalled();
		expect(updateHaveItemRarityMission).toHaveBeenCalledWith(player, response);
		expect(MissionsController.update).not.toHaveBeenCalled();
	});

	it("uses an empty backup slot when the active slot is taken", async () => {
		const stored = chestSlot(1, STORED_ITEM);
		const active = inventorySlot(0, CARRIED_ITEM);
		const emptyBackup = inventorySlot(1, EMPTY_ITEM);
		vi.mocked(HomeChestSlots.getSlot).mockResolvedValue(stored);
		vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([emptyArmorSlot(0), emptyArmorSlot(1), active, emptyBackup]);

		await act(HomeConstants.CHEST_ACTIONS.WITHDRAW, 1);

		expect(itemOf(active)).toEqual(CARRIED_ITEM);
		expect(itemOf(emptyBackup)).toEqual(STORED_ITEM);
		expect(itemOf(stored)).toEqual(EMPTY_ITEM);
	});

	it("creates a backup slot within the capacity granted by the inventory and the home", async () => {
		const stored = chestSlot(1, STORED_ITEM);
		vi.mocked(HomeChestSlots.getSlot).mockResolvedValue(stored);
		vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([inventorySlot(0, CARRIED_ITEM), inventorySlot(1, CARRIED_ITEM), emptyArmorSlot(2)]);
		const create = vi.spyOn(InventorySlot, "create").mockResolvedValue(inventorySlot(2, STORED_ITEM));

		// Two weapon slots of the inventory plus the weapon slot of the level 4 home: room for a backup slot 2
		giveInventoryInfo(2);
		const { result } = await act(HomeConstants.CHEST_ACTIONS.WITHDRAW, 1);

		expect(result.success).toBe(true);
		expect(create).toHaveBeenCalledWith({
			playerId: player.id, slot: 2, itemCategory: ItemCategory.WEAPON, ...STORED_ITEM
		});
		expect(itemOf(stored)).toEqual(EMPTY_ITEM);
	});

	it("keeps the item in the chest when the inventory is full", async () => {
		const stored = chestSlot(1, STORED_ITEM);
		vi.mocked(HomeChestSlots.getSlot).mockResolvedValue(stored);
		vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([inventorySlot(0, CARRIED_ITEM), inventorySlot(1, CARRIED_ITEM)]);
		const create = vi.spyOn(InventorySlot, "create");

		// One weapon slot of the inventory plus the weapon slot of the level 4 home: the backup slot 1 is the last one
		giveInventoryInfo(1);
		const homeBonus = await act(HomeConstants.CHEST_ACTIONS.WITHDRAW, 1);
		home.level = 1;
		giveInventoryInfo(2);
		const noHomeBonus = await act(HomeConstants.CHEST_ACTIONS.WITHDRAW, 1);
		vi.spyOn(InventoryInfo, "findOne").mockResolvedValue(null);
		const noInventoryInfo = await act(HomeConstants.CHEST_ACTIONS.WITHDRAW, 1);

		for (const { result } of [homeBonus, noHomeBonus, noInventoryInfo]) {
			expect(result).toMatchObject({
				success: false, error: HomeConstants.CHEST_ERRORS.INVENTORY_FULL
			});
		}
		expect(create).not.toHaveBeenCalled();
		expect(itemOf(stored)).toEqual(STORED_ITEM);
		expect(stored.save).not.toHaveBeenCalled();
		expect(updateHaveItemRarityMission).not.toHaveBeenCalled();
	});

	it("refuses an empty or missing chest slot", async () => {
		vi.mocked(HomeChestSlots.getSlot).mockResolvedValueOnce(chestSlot(1, EMPTY_ITEM));
		const empty = await act(HomeConstants.CHEST_ACTIONS.WITHDRAW, 1);
		vi.mocked(HomeChestSlots.getSlot).mockResolvedValueOnce(null);
		const missing = await act(HomeConstants.CHEST_ACTIONS.WITHDRAW, 1);

		expect([empty.result.error, missing.result.error]).toEqual([HomeConstants.CHEST_ERRORS.INVALID, HomeConstants.CHEST_ERRORS.INVALID]);
		expect(InventorySlots.getOfPlayer).not.toHaveBeenCalled();
	});
});

describe("swap", () => {
	it("exchanges the inventory item and the chest item and updates both missions", async () => {
		const carried = inventorySlot(0, CARRIED_ITEM);
		const stored = chestSlot(2, STORED_ITEM);
		vi.mocked(InventorySlots.getItem).mockResolvedValue(carried);
		vi.mocked(HomeChestSlots.getSlot).mockResolvedValue(stored);

		const { result, response } = await act(HomeConstants.CHEST_ACTIONS.SWAP, 0, 2);

		expect(HomeChestSlots.getSlot).toHaveBeenCalledWith(HOME_ID, 2, ItemCategory.WEAPON);
		expect(result.success).toBe(true);
		expect(itemOf(carried)).toEqual(STORED_ITEM);
		expect(itemOf(stored)).toEqual(CARRIED_ITEM);
		expect(carried.save).toHaveBeenCalled();
		expect(stored.save).toHaveBeenCalled();
		expect(MissionsController.update).toHaveBeenCalledWith(player, response, { missionId: "depositChestItem" });
		expect(updateHaveItemRarityMission).toHaveBeenCalledWith(player, response);
	});

	it("refuses when either side is empty", async () => {
		const carried = inventorySlot(0, CARRIED_ITEM);
		vi.mocked(InventorySlots.getItem).mockResolvedValueOnce(inventorySlot(0, EMPTY_ITEM));
		const emptyInventory = await act(HomeConstants.CHEST_ACTIONS.SWAP, 0, 2);
		vi.mocked(InventorySlots.getItem).mockResolvedValueOnce(null);
		const missingInventory = await act(HomeConstants.CHEST_ACTIONS.SWAP, 0, 2);
		vi.mocked(InventorySlots.getItem).mockResolvedValue(carried);
		vi.mocked(HomeChestSlots.getSlot).mockResolvedValueOnce(chestSlot(2, EMPTY_ITEM));
		const emptyChest = await act(HomeConstants.CHEST_ACTIONS.SWAP, 0, 2);
		vi.mocked(HomeChestSlots.getSlot).mockResolvedValueOnce(null);
		const missingChest = await act(HomeConstants.CHEST_ACTIONS.SWAP, 0, 2);

		for (const { result } of [emptyInventory, missingInventory, emptyChest, missingChest]) {
			expect(result.error).toBe(HomeConstants.CHEST_ERRORS.INVALID);
		}
		expect(itemOf(carried)).toEqual(CARRIED_ITEM);
		expect(carried.save).not.toHaveBeenCalled();
	});
});
