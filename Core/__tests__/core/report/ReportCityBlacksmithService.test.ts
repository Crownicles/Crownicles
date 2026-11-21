import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn()
	}
}));
vi.mock("../../../src/app", () => ({
	crowniclesInstance: {
		logsDatabase: {
			logBlacksmithUpgrade: vi.fn().mockResolvedValue(undefined),
			logBlacksmithEnchantmentTransfer: vi.fn().mockResolvedValue(undefined)
		}
	}
}));
vi.mock("../../../src/core/database/game/models/InventorySlot", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/InventorySlot")>(),
	InventorySlots: { getOfPlayer: vi.fn() }
}));
vi.mock("../../../src/core/database/game/models/Material", () => ({
	Materials: {
		getPlayerMaterials: vi.fn(), consumeMaterials: vi.fn()
	}
}));
vi.mock("../../../src/core/database/game/models/Home", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/Home")>(),
	Homes: { getOfPlayer: vi.fn() }
}));
vi.mock("../../../src/core/utils/withLockedPlayerAndMissions", () => ({
	withLockedPlayerAndMissions: vi.fn()
}));
vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn().mockResolvedValue(undefined) }
}));

import {
	handleBlacksmithEnchantmentTransferReaction, handleBlacksmithUpgradeReaction, handleUpgradeItemReaction, validateUpgradeItemRequest
} from "../../../src/core/report/ReportCityBlacksmithService";
import { buildBlacksmithData } from "../../../src/core/report/ReportBlacksmithService";
import { buildUpgradeStationData } from "../../../src/core/report/ReportCityService";
import InventorySlot, { InventorySlots } from "../../../src/core/database/game/models/InventorySlot";
import { Materials } from "../../../src/core/database/game/models/Material";
import {
	Home, Homes
} from "../../../src/core/database/game/models/Home";
import { withLockedPlayerAndMissions } from "../../../src/core/utils/withLockedPlayerAndMissions";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { crowniclesInstance } from "../../../src/app";
import { ReactionCollectorCityData } from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	ItemCategory, ItemRarity
} from "../../../../Lib/src/constants/ItemConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { BlacksmithConstants } from "../../../../Lib/src/constants/BlacksmithConstants";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";
import { HomeLevel } from "../../../../Lib/src/types/HomeLevel";
import { makeInventorySlot } from "./CityPlayerFixture";
import {
	asPlayer, CityHandlerPlayer, describePackets, makeHandlerPlayer
} from "./CityHandlerFixture";
import { makeHome } from "../ModelStubs";

/*
 * Real item data: the common weapon 2 needs the common materials 24 and 70 for its first upgrade, which costs
 * round(50 * (1 + (COMMON - EPIC) * 9%)) = 28 coins
 */
const COMMON_WEAPON_ID = 2;
const RARE_WEAPON_ID = 11;
const FIRST_UPGRADE_PRICE = 28;
const ONE_COMMON_MATERIAL_PRICE = 340;
const TWO_COMMON_MATERIALS_PRICE = 714;
const ALL_MATERIALS = new Map([[24, 1], [70, 1]]);

const logs = crowniclesInstance?.logsDatabase;

type Slot = InventorySlot & { save: ReturnType<typeof vi.fn> };

function slotOf(slot: Parameters<typeof makeInventorySlot>[0]): Slot {
	return Object.assign(makeInventorySlot(slot), { save: vi.fn().mockResolvedValue(undefined) });
}

function commonWeapon(): Slot {
	return slotOf({
		slot: 0, itemCategory: ItemCategory.WEAPON, itemId: COMMON_WEAPON_ID
	});
}

function giveInventory(...slots: Slot[]): void {
	vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue(slots);
}

function giveMaterials(materials: Map<number, number>): void {
	vi.mocked(Materials.getPlayerMaterials).mockResolvedValue([...materials].map(([materialId, quantity]) => ({
		materialId, quantity
	})) as Awaited<ReturnType<typeof Materials.getPlayerMaterials>>);
}

function lockPlayer(lockedPlayer: CityHandlerPlayer): void {
	vi.mocked(withLockedPlayerAndMissions).mockImplementation((_playerId, callback) => callback(asPlayer(lockedPlayer)));
}

/**
 * City data as the menu builds it from the player inventory and materials
 */
function openBlacksmith(player: CityHandlerPlayer, slots: Slot[], materials: Map<number, number>): ReactionCollectorCityData {
	// The blacksmith handlers only read the blacksmith part of the city data
	return { blacksmith: buildBlacksmithData(slots, materials, asPlayer(player)) } as ReactionCollectorCityData;
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(Materials.consumeMaterials).mockResolvedValue(true);
});

describe("handleBlacksmithUpgradeReaction", () => {
	async function upgrade(player: CityHandlerPlayer, data: ReactionCollectorCityData, buyMaterials: boolean, slot = 0): Promise<CrowniclesPacket[]> {
		const response: CrowniclesPacket[] = [];
		await handleBlacksmithUpgradeReaction(asPlayer(player), {
			slot, itemCategory: ItemCategory.WEAPON, buyMaterials
		}, data, response);
		return response;
	}

	it("consumes the owned materials, debits the upgrade price and raises the item level", async () => {
		const player = makeHandlerPlayer(FIRST_UPGRADE_PRICE);
		const weapon = commonWeapon();
		const data = openBlacksmith(player, [weapon], ALL_MATERIALS);
		giveInventory(weapon);
		giveMaterials(ALL_MATERIALS);
		lockPlayer(player);

		const response = await upgrade(player, data, false);

		expect(Materials.consumeMaterials).toHaveBeenCalledWith(player.id, [
			{
				materialId: 24, quantity: 1
			},
			{
				materialId: 70, quantity: 1
			}
		]);
		expect(player.spendMoney).toHaveBeenCalledWith({
			response, amount: FIRST_UPGRADE_PRICE, reason: NumberChangeReason.BLACKSMITH_UPGRADE
		});
		expect(player.money).toBe(0);
		expect(weapon.itemLevel).toBe(1);
		expect(weapon.save).toHaveBeenCalled();
		expect(player.save).toHaveBeenCalled();
		expect(describePackets(response)).toEqual([["CommandReportBlacksmithUpgradeRes", {
			itemCategory: ItemCategory.WEAPON, newItemLevel: 1, totalCost: FIRST_UPGRADE_PRICE, boughtMaterials: false
		}]]);
		expect(MissionsController.update).toHaveBeenCalledWith(player, response, { missionId: "upgradeItem" });
		expect(MissionsController.update).toHaveBeenCalledWith(player, response, {
			missionId: "upgradeEpicItemLevel5", params: {
				rarity: ItemRarity.COMMON, newLevel: 1
			}
		});
		expect(logs?.logBlacksmithUpgrade).toHaveBeenCalledWith({
			keycloakId: player.keycloakId,
			cityId: "boug_coton",
			itemCategory: ItemCategory.WEAPON,
			slot: 0,
			fromLevel: 0,
			toLevel: 1,
			totalCost: FIRST_UPGRADE_PRICE,
			boughtMaterials: false,
			materialsCost: null
		});
	});

	it("sells the missing materials at the menu price and consumes only the owned ones", async () => {
		const ownedMaterials = new Map([[24, 1]]);
		const total = FIRST_UPGRADE_PRICE + ONE_COMMON_MATERIAL_PRICE;
		const player = makeHandlerPlayer(total);
		const weapon = commonWeapon();
		const data = openBlacksmith(player, [weapon], ownedMaterials);
		giveInventory(weapon);
		giveMaterials(ownedMaterials);
		lockPlayer(player);

		const response = await upgrade(player, data, true);

		expect(data.blacksmith?.upgradeableItems[0]).toMatchObject({
			upgradeCost: FIRST_UPGRADE_PRICE, missingMaterialsCost: ONE_COMMON_MATERIAL_PRICE
		});
		expect(Materials.consumeMaterials).toHaveBeenCalledWith(player.id, [{
			materialId: 24, quantity: 1
		}]);
		expect(player.money).toBe(0);
		expect(response[response.length - 1]).toMatchObject({
			totalCost: total, boughtMaterials: true
		});
		expect(logs?.logBlacksmithUpgrade).toHaveBeenCalledWith(expect.objectContaining({
			totalCost: total, boughtMaterials: true, materialsCost: ONE_COMMON_MATERIAL_PRICE
		}));
	});

	it("sells only the missing part of a material required several times", async () => {
		// The rare weapon 11 needs two materials 7 for its first upgrade, which costs round(50 * (1 + (RARE - EPIC) * 9%)) = 41
		const ownedMaterials = new Map([[7, 1], [34, 1], [21, 1], [77, 1]]);
		const total = 41 + ONE_COMMON_MATERIAL_PRICE;
		const player = makeHandlerPlayer(total);
		const weapon = slotOf({
			slot: 0, itemCategory: ItemCategory.WEAPON, itemId: RARE_WEAPON_ID
		});
		const data = openBlacksmith(player, [weapon], ownedMaterials);
		giveInventory(weapon);
		giveMaterials(ownedMaterials);
		lockPlayer(player);

		await upgrade(player, data, true);

		expect(player.money).toBe(0);
		expect(Materials.consumeMaterials).toHaveBeenCalledWith(player.id, [7, 34, 21, 77].map(materialId => ({
			materialId, quantity: 1
		})));
	});

	it("does not consume anything when every material is bought", async () => {
		const total = FIRST_UPGRADE_PRICE + TWO_COMMON_MATERIALS_PRICE;
		const player = makeHandlerPlayer(total);
		const weapon = commonWeapon();
		const data = openBlacksmith(player, [weapon], new Map());
		giveInventory(weapon);
		giveMaterials(new Map());
		lockPlayer(player);

		await upgrade(player, data, true);

		expect(Materials.consumeMaterials).not.toHaveBeenCalled();
		expect(player.money).toBe(0);
		expect(weapon.itemLevel).toBe(1);
	});

	it("does not upgrade an item the menu did not list, nor without blacksmith", async () => {
		const player = makeHandlerPlayer(1_000_000);
		const weapon = commonWeapon();
		const data = openBlacksmith(player, [weapon], ALL_MATERIALS);

		const unlisted = await upgrade(player, data, true, 1);
		const otherCategory: CrowniclesPacket[] = [];
		await handleBlacksmithUpgradeReaction(asPlayer(player), {
			slot: 0, itemCategory: ItemCategory.ARMOR, buyMaterials: true
		}, data, otherCategory);
		const noBlacksmith = await upgrade(player, {} as ReactionCollectorCityData, true);

		expect([...unlisted, ...otherCategory, ...noBlacksmith]).toEqual([]);
		expect(withLockedPlayerAndMissions).not.toHaveBeenCalled();
	});

	it("tells the exact missing money, materials included, without locking", async () => {
		const player = makeHandlerPlayer(FIRST_UPGRADE_PRICE + TWO_COMMON_MATERIALS_PRICE - 5);
		const data = openBlacksmith(player, [commonWeapon()], new Map());
		giveMaterials(new Map());

		const response = await upgrade(player, data, true);

		expect(describePackets(response)).toEqual([["CommandReportBlacksmithNotEnoughMoneyRes", { missingMoney: 5 }]]);
		expect(withLockedPlayerAndMissions).not.toHaveBeenCalled();
	});

	it("refuses when materials are missing and the player does not buy them", async () => {
		const player = makeHandlerPlayer(1_000_000);
		const data = openBlacksmith(player, [commonWeapon()], new Map([[24, 1]]));
		giveMaterials(new Map([[24, 1]]));

		const response = await upgrade(player, data, false);

		expect(describePackets(response)).toEqual([["CommandReportBlacksmithMissingMaterialsRes", {}]]);
		expect(withLockedPlayerAndMissions).not.toHaveBeenCalled();
	});

	it("re-checks the locked player: no upgrade when the money was spent meanwhile", async () => {
		const player = makeHandlerPlayer(FIRST_UPGRADE_PRICE);
		const lockedPlayer = makeHandlerPlayer(FIRST_UPGRADE_PRICE - 1);
		const weapon = commonWeapon();
		const data = openBlacksmith(player, [weapon], ALL_MATERIALS);
		giveInventory(weapon);
		giveMaterials(ALL_MATERIALS);
		lockPlayer(lockedPlayer);

		const response = await upgrade(player, data, false);

		expect(describePackets(response)).toEqual([["CommandReportBlacksmithNotEnoughMoneyRes", { missingMoney: 1 }]]);
		expect(Materials.consumeMaterials).not.toHaveBeenCalled();
		expect(weapon.itemLevel).toBe(0);
	});

	it("neither debits nor upgrades when the materials were consumed meanwhile", async () => {
		const player = makeHandlerPlayer(FIRST_UPGRADE_PRICE);
		const weapon = commonWeapon();
		const data = openBlacksmith(player, [weapon], ALL_MATERIALS);
		giveInventory(weapon);
		giveMaterials(ALL_MATERIALS);
		lockPlayer(player);
		vi.mocked(Materials.consumeMaterials).mockResolvedValue(false);

		const response = await upgrade(player, data, false);

		expect(describePackets(response)).toEqual([["CommandReportBlacksmithMissingMaterialsRes", {}]]);
		expect(player.spendMoney).not.toHaveBeenCalled();
		expect(weapon.itemLevel).toBe(0);
	});

	it("refuses when the slot no longer holds the listed equipment", async () => {
		const player = makeHandlerPlayer(FIRST_UPGRADE_PRICE);
		const data = openBlacksmith(player, [commonWeapon()], ALL_MATERIALS);
		const upgradedMeanwhile = Object.assign(commonWeapon(), { itemLevel: 1 });
		giveInventory(upgradedMeanwhile);
		giveMaterials(ALL_MATERIALS);
		lockPlayer(player);

		const response = await upgrade(player, data, false);

		expect(describePackets(response)).toEqual([["CommandReportEquipmentChangedRes", {}]]);
		expect(player.spendMoney).not.toHaveBeenCalled();
		expect(upgradedMeanwhile.itemLevel).toBe(1);
	});

	it("does not log an upgrade made outside of a city", async () => {
		const player = makeHandlerPlayer(FIRST_UPGRADE_PRICE);
		player.getCurrentCityId.mockReturnValue(null);
		const weapon = commonWeapon();
		const data = openBlacksmith(player, [weapon], ALL_MATERIALS);
		giveInventory(weapon);
		giveMaterials(ALL_MATERIALS);
		lockPlayer(player);

		await upgrade(player, data, false);

		expect(weapon.itemLevel).toBe(1);
		expect(logs?.logBlacksmithUpgrade).not.toHaveBeenCalled();
	});
});

describe("handleBlacksmithEnchantmentTransferReaction", () => {
	const price = BlacksmithConstants.ENCHANTMENT_TRANSFER_PRICE[ItemRarity.RARE];

	function transferSetup(money: number): {
		player: CityHandlerPlayer; source: Slot; target: Slot; data: ReactionCollectorCityData;
	} {
		const player = makeHandlerPlayer(money);
		const source = slotOf({
			slot: 0, itemCategory: ItemCategory.WEAPON, itemId: COMMON_WEAPON_ID, itemEnchantmentId: ItemEnchantment.PVE_ATTACK_1.id
		});
		const target = slotOf({
			slot: 1, itemCategory: ItemCategory.WEAPON, itemId: RARE_WEAPON_ID
		});
		const data = openBlacksmith(player, [source, target], new Map());
		giveInventory(source, target);
		lockPlayer(player);
		return {
			player, source, target, data
		};
	}

	async function transfer(player: CityHandlerPlayer, data: ReactionCollectorCityData, targetSlot = 1): Promise<CrowniclesPacket[]> {
		const response: CrowniclesPacket[] = [];
		await handleBlacksmithEnchantmentTransferReaction(asPlayer(player), {
			itemCategory: ItemCategory.WEAPON, sourceSlot: 0, targetSlot
		}, data, response);
		return response;
	}

	it("moves the enchantment onto the target and debits the price of the target rarity", async () => {
		const {
			player, source, target, data
		} = transferSetup(price);

		const response = await transfer(player, data);

		expect([source.itemEnchantmentId, target.itemEnchantmentId]).toEqual([null, ItemEnchantment.PVE_ATTACK_1.id]);
		expect(source.save).toHaveBeenCalled();
		expect(target.save).toHaveBeenCalled();
		expect(player.spendMoney).toHaveBeenCalledWith({
			response, amount: price, reason: NumberChangeReason.BLACKSMITH_ENCHANTMENT_TRANSFER
		});
		expect(player.money).toBe(0);
		expect(player.save).toHaveBeenCalled();
		expect(describePackets(response)).toEqual([["CommandReportBlacksmithEnchantmentTransferRes", {
			enchantmentId: ItemEnchantment.PVE_ATTACK_1.id, enchantmentType: ItemEnchantment.PVE_ATTACK_1.kind.type.id, cost: price
		}]]);
		expect(logs?.logBlacksmithEnchantmentTransfer).toHaveBeenCalledWith({
			keycloakId: player.keycloakId,
			cityId: "boug_coton",
			itemCategory: ItemCategory.WEAPON,
			sourceSlot: 0,
			targetSlot: 1,
			enchantmentId: ItemEnchantment.PVE_ATTACK_1.id,
			cost: price
		});
	});

	it("does not log a transfer made outside of a city", async () => {
		const {
			player, data
		} = transferSetup(price);
		player.getCurrentCityId.mockReturnValue(null);

		await transfer(player, data);

		expect(player.money).toBe(0);
		expect(logs?.logBlacksmithEnchantmentTransfer).not.toHaveBeenCalled();
	});

	it("refuses an unlisted target and tells the missing money before and after locking", async () => {
		const {
			player, source, data
		} = transferSetup(price);
		const unlisted = await transfer(player, data, 2);
		const otherCategory: CrowniclesPacket[] = [];
		await handleBlacksmithEnchantmentTransferReaction(asPlayer(player), {
			itemCategory: ItemCategory.ARMOR, sourceSlot: 0, targetSlot: 1
		}, data, otherCategory);
		const unlistedSource: CrowniclesPacket[] = [];
		await handleBlacksmithEnchantmentTransferReaction(asPlayer(player), {
			itemCategory: ItemCategory.WEAPON, sourceSlot: 1, targetSlot: 0
		}, data, unlistedSource);
		const noBlacksmith = await transfer(player, {} as ReactionCollectorCityData);
		player.money = price - 2;
		const poor = await transfer(player, data);
		expect(withLockedPlayerAndMissions).not.toHaveBeenCalled();
		const lockedPlayer = makeHandlerPlayer(price - 3);
		player.money = price;
		lockPlayer(lockedPlayer);
		const poorLocked = await transfer(player, data);

		expect([...unlisted, ...otherCategory, ...unlistedSource, ...noBlacksmith]).toEqual([]);
		expect(describePackets(poor)).toEqual([["CommandReportBlacksmithNotEnoughMoneyRes", { missingMoney: 2 }]]);
		expect(describePackets(poorLocked)).toEqual([["CommandReportBlacksmithNotEnoughMoneyRes", { missingMoney: 3 }]]);
		expect(source.itemEnchantmentId).toBe(ItemEnchantment.PVE_ATTACK_1.id);
		expect(lockedPlayer.spendMoney).not.toHaveBeenCalled();
	});

	it("refuses when the source or the target changed since the menu was opened", async () => {
		const {
			player, source, target, data
		} = transferSetup(price);
		target.itemEnchantmentId = ItemEnchantment.ALL_ATTACK_1.id;
		const targetChanged = await transfer(player, data);
		target.itemEnchantmentId = null;
		source.itemEnchantmentId = null;
		const sourceChanged = await transfer(player, data);

		expect(describePackets(targetChanged)).toEqual([["CommandReportEquipmentChangedRes", {}]]);
		expect(describePackets(sourceChanged)).toEqual([["CommandReportEquipmentChangedRes", {}]]);
		expect(player.spendMoney).not.toHaveBeenCalled();
		expect(target.save).not.toHaveBeenCalled();
	});
});

describe("home upgrade station", () => {
	function stationData(player: CityHandlerPlayer, slots: Slot[], materials: Map<number, number>, homeLevel = HomeLevel.LEVEL_1): ReactionCollectorCityData {
		// The upgrade station handler only reads the owned home part of the city data
		return {
			home: {
				owned: {
					level: homeLevel.level,
					features: homeLevel.features,
					upgradeStation: buildUpgradeStationData(slots, materials, homeLevel, asPlayer(player))
				}
			}
		} as ReactionCollectorCityData;
	}

	describe("validateUpgradeItemRequest", () => {
		const reaction = {
			slot: 0, itemCategory: ItemCategory.WEAPON
		};

		it("accepts a listed item the home can upgrade with the owned materials", () => {
			const player = makeHandlerPlayer(0);

			const result = validateUpgradeItemRequest(asPlayer(player), reaction, stationData(player, [commonWeapon()], ALL_MATERIALS));

			expect(result.error).toBeUndefined();
			expect(result.logError).toBeUndefined();
			expect(result.itemToUpgrade).toMatchObject({
				slot: 0, nextLevel: 1, canUpgrade: true
			});
		});

		it("rejects an item missing materials, an unlisted item and a request without upgrade station", () => {
			const player = makeHandlerPlayer(0);

			const missing = validateUpgradeItemRequest(asPlayer(player), reaction, stationData(player, [commonWeapon()], new Map()));
			const unlisted = validateUpgradeItemRequest(asPlayer(player), {
				...reaction, slot: 1
			}, stationData(player, [commonWeapon()], ALL_MATERIALS));
			const otherCategory = validateUpgradeItemRequest(asPlayer(player), {
				...reaction, itemCategory: ItemCategory.ARMOR
			}, stationData(player, [commonWeapon()], ALL_MATERIALS));
			const noStation = validateUpgradeItemRequest(asPlayer(player), reaction, { home: {} } as ReactionCollectorCityData);

			expect(missing.error?.constructor.name).toBe("CommandReportUpgradeItemMissingMaterialsRes");
			expect(unlisted.error?.constructor.name).toBe("CommandReportEquipmentChangedRes");
			expect(otherCategory.error?.constructor.name).toBe("CommandReportEquipmentChangedRes");
			expect(noStation.logError).toBeDefined();
			expect(noStation.itemToUpgrade).toBeUndefined();
		});

		it("rejects a level above the maximum of the home", () => {
			const player = makeHandlerPlayer(0);
			const data = stationData(player, [commonWeapon()], ALL_MATERIALS);
			const atMaximum = validateUpgradeItemRequest(asPlayer(player), reaction, data);
			const lowerHome = {
				home: {
					owned: {
						...data.home.owned, features: {
							...HomeLevel.LEVEL_1.features, maxItemUpgradeLevel: 0
						}
					}
				}
			} as ReactionCollectorCityData;

			expect(atMaximum.itemToUpgrade).toBeDefined();
			expect(validateUpgradeItemRequest(asPlayer(player), reaction, lowerHome).error?.constructor.name).toBe("CommandReportUpgradeItemMaxLevelRes");
		});
	});

	describe("handleUpgradeItemReaction", () => {
		async function upgradeAtHome(player: CityHandlerPlayer, data: ReactionCollectorCityData): Promise<CrowniclesPacket[]> {
			const response: CrowniclesPacket[] = [];
			await handleUpgradeItemReaction(asPlayer(player), {
				slot: 0, itemCategory: ItemCategory.WEAPON
			}, data, response);
			return response;
		}

		it("consumes the materials of the next level and raises the item level", async () => {
			const player = makeHandlerPlayer(0);
			const weapon = commonWeapon();
			const data = stationData(player, [weapon], ALL_MATERIALS);
			giveInventory(weapon);
			giveMaterials(ALL_MATERIALS);
			vi.mocked(Homes.getOfPlayer).mockResolvedValue(makeHome({ level: 1 }));
			lockPlayer(player);

			const response = await upgradeAtHome(player, data);

			expect(Materials.consumeMaterials).toHaveBeenCalledWith(player.id, [
				{
					materialId: 24, quantity: 1
				},
				{
					materialId: 70, quantity: 1
				}
			]);
			expect(weapon.itemLevel).toBe(1);
			expect(weapon.save).toHaveBeenCalled();
			expect(describePackets(response)).toEqual([["CommandReportUpgradeItemRes", {
				itemCategory: ItemCategory.WEAPON, newItemLevel: 1
			}]]);
			expect(MissionsController.update).toHaveBeenCalledWith(player, response, { missionId: "upgradeItem" });
		});

		it("re-validates against the current materials: no upgrade when they were spent since the menu was opened", async () => {
			const player = makeHandlerPlayer(0);
			const weapon = commonWeapon();
			const data = stationData(player, [weapon], ALL_MATERIALS);
			giveInventory(weapon);
			giveMaterials(new Map([[24, 1]]));
			vi.mocked(Homes.getOfPlayer).mockResolvedValue(makeHome({ level: 1 }));
			lockPlayer(player);

			const response = await upgradeAtHome(player, data);

			expect(describePackets(response)).toEqual([["CommandReportUpgradeItemMissingMaterialsRes", {}]]);
			expect(Materials.consumeMaterials).not.toHaveBeenCalled();
			expect(weapon.itemLevel).toBe(0);
		});

		it("does not upgrade when the consumption fails, the home disappeared or the slot changed", async () => {
			const player = makeHandlerPlayer(0);
			const weapon = commonWeapon();
			const data = stationData(player, [weapon], ALL_MATERIALS);
			giveInventory(weapon);
			giveMaterials(ALL_MATERIALS);
			lockPlayer(player);
			vi.mocked(Homes.getOfPlayer).mockResolvedValue(makeHome({ level: 1 }));
			vi.mocked(Materials.consumeMaterials).mockResolvedValue(false);
			const consumptionFailed = await upgradeAtHome(player, data);
			vi.mocked(Homes.getOfPlayer).mockResolvedValue(null);
			const homeless = await upgradeAtHome(player, data);
			giveInventory(Object.assign(commonWeapon(), { itemId: RARE_WEAPON_ID }));
			const changed = await upgradeAtHome(player, data);

			expect(describePackets(consumptionFailed)).toEqual([["CommandReportUpgradeItemMissingMaterialsRes", {}]]);
			expect(homeless).toEqual([]);
			expect(describePackets(changed)).toEqual([["CommandReportEquipmentChangedRes", {}]]);
			expect(weapon.itemLevel).toBe(0);
			expect(MissionsController.update).not.toHaveBeenCalled();
		});
	});
});
