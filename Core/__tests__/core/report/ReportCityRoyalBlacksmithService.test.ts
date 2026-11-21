import {
	beforeEach, describe, expect, it, vi
} from "vitest";

vi.mock("../../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn(),
		init: vi.fn(),
		get: vi.fn()
	}
}));

vi.mock("../../../src/app", () => ({
	crowniclesInstance: {
		logsDatabase: { logBlacksmithUpgrade: vi.fn().mockResolvedValue(undefined) }
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
vi.mock("../../../src/core/database/game/models/PlayerMissionsInfo", async importOriginal => ({
	...await importOriginal<typeof import("../../../src/core/database/game/models/PlayerMissionsInfo")>(),
	PlayerMissionsInfos: { getOfPlayer: vi.fn() }
}));
vi.mock("../../../src/core/database/game/models/DailyMission", () => ({
	DailyMissions: { getOrGenerate: vi.fn() }
}));
vi.mock("../../../src/core/database/game/models/PlayerBadges", () => ({
	PlayerBadgesManager: {
		hasBadge: vi.fn(), addBadge: vi.fn()
	}
}));
vi.mock("../../../../Lib/src/locks/withLockedEntities", () => ({
	withLockedEntities: vi.fn()
}));
vi.mock("../../../src/core/missions/MissionsController", () => ({
	MissionsController: { update: vi.fn().mockResolvedValue(undefined) }
}));

import {
	buildExecutionData, findRoyalBlacksmithItem, handleRoyalBlacksmithUpgradeReaction
} from "../../../src/core/report/ReportCityRoyalBlacksmithService";
import { buildRoyalBlacksmithData } from "../../../src/core/report/ReportRoyalBlacksmithService";
import {
	ReactionCollectorCityData, ReactionCollectorRoyalBlacksmithUpgradeReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { Player } from "../../../src/core/database/game/models/Player";
import InventorySlot, { InventorySlots } from "../../../src/core/database/game/models/InventorySlot";
import { Materials } from "../../../src/core/database/game/models/Material";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../../../src/core/database/game/models/PlayerMissionsInfo";
import { PlayerBadgesManager } from "../../../src/core/database/game/models/PlayerBadges";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";
import { MissionsController } from "../../../src/core/missions/MissionsController";
import { crowniclesInstance } from "../../../src/app";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	ItemCategory, ItemRarity
} from "../../../../Lib/src/constants/ItemConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { RoyalBlacksmithConstants } from "../../../../Lib/src/constants/BlacksmithConstants";
import { Badge } from "../../../../Lib/src/types/Badge";
import { makeInventorySlot } from "./CityPlayerFixture";
import {
	asPlayer, CityHandlerPlayer, describePackets, lockedEntitiesOf, makeHandlerPlayer
} from "./CityHandlerFixture";

function makeItem(overrides: Partial<{
	slot: number;
	category: number;
	upgradeCost: number;
	gemCost: number;
	missingMaterialsCost: number;
	requiredMaterials: {
		materialId: number; rarity: number; quantity: number; playerQuantity: number;
	}[];
}> = {}): Parameters<typeof buildExecutionData>[0]["item"] {
	return {
		slot: 0,
		category: 0,
		details: {} as never,
		upgradeCost: 7500,
		gemCost: 3,
		itemRarity: 4,
		requiredMaterials: [
			{
				materialId: 10, rarity: 1, quantity: 2, playerQuantity: 2
			}
		],
		missingMaterialsCost: 0,
		hasAllMaterials: true,
		canUpgrade: true,
		canBuyAndUpgrade: false,
		...overrides
	};
}

describe("buildExecutionData", () => {
	it("returns zero material extra cost when the player has every required material", () => {
		const item = makeItem();
		const stock = new Map<number, number>([[10, 5]]);
		const exec = buildExecutionData({
			item,
			materialStock: stock,
			buyMaterials: false
		});

		expect(exec.hasAllMaterials).toBe(true);
		expect(exec.boughtMaterials).toBe(false);
		expect(exec.materialsExtraCost).toBe(0);
		expect(exec.totalMoneyCost).toBe(item.upgradeCost);
		expect(exec.gemCost).toBe(item.gemCost);
		expect(exec.materialsToConsume).toEqual([{
			materialId: 10, quantity: 2
		}]);
	});

	it("does not charge material extra cost when player refuses to buy missing materials", () => {
		const item = makeItem({
			requiredMaterials: [
				{
					materialId: 10, rarity: 1, quantity: 3, playerQuantity: 1
				}
			]
		});
		const stock = new Map<number, number>([[10, 1]]);
		const exec = buildExecutionData({
			item,
			materialStock: stock,
			buyMaterials: false
		});

		expect(exec.hasAllMaterials).toBe(false);
		expect(exec.boughtMaterials).toBe(false);
		expect(exec.materialsExtraCost).toBe(0);
		expect(exec.totalMoneyCost).toBe(item.upgradeCost);
	});

	it("adds purchased material price to total money cost when buying missing materials", () => {
		const item = makeItem({
			requiredMaterials: [
				{
					materialId: 10, rarity: 1, quantity: 3, playerQuantity: 1
				},
				{
					materialId: 11, rarity: 1, quantity: 1, playerQuantity: 1
				}
			]
		});
		const stock = new Map<number, number>([[10, 1], [11, 1]]);
		const exec = buildExecutionData({
			item,
			materialStock: stock,
			buyMaterials: true
		});

		expect(exec.hasAllMaterials).toBe(false);
		expect(exec.boughtMaterials).toBe(true);
		expect(exec.materialsExtraCost).toBeGreaterThan(0);
		expect(exec.totalMoneyCost).toBe(item.upgradeCost + exec.materialsExtraCost);
	});

	it("ignores buyMaterials flag when nothing is missing", () => {
		const item = makeItem();
		const stock = new Map<number, number>([[10, 10]]);
		const exec = buildExecutionData({
			item,
			materialStock: stock,
			buyMaterials: true
		});

		expect(exec.boughtMaterials).toBe(false);
		expect(exec.materialsExtraCost).toBe(0);
	});

	it("reports every required material in materialsToConsume", () => {
		const item = makeItem({
			requiredMaterials: [
				{
					materialId: 10, rarity: 1, quantity: 2, playerQuantity: 2
				},
				{
					materialId: 11, rarity: 2, quantity: 5, playerQuantity: 5
				}
			]
		});
		const stock = new Map<number, number>([[10, 2], [11, 5]]);
		const exec = buildExecutionData({
			item,
			materialStock: stock,
			buyMaterials: false
		});

		expect(exec.materialsToConsume).toEqual([
			{
				materialId: 10, quantity: 2
			},
			{
				materialId: 11, quantity: 5
			}
		]);
	});
});

describe("findRoyalBlacksmithItem", () => {
	const fakePlayer = { keycloakId: "test-player" } as Player;

	function makeReaction(slot: number, category: number): ReactionCollectorRoyalBlacksmithUpgradeReaction {
		const reaction = new ReactionCollectorRoyalBlacksmithUpgradeReaction();
		reaction.slot = slot;
		reaction.itemCategory = category;
		reaction.buyMaterials = false;
		return reaction;
	}

	function makeRoyalItem(slot: number, category: number): Parameters<typeof buildExecutionData>[0]["item"] {
		return makeItem({
			slot, category
		});
	}

	it("returns null when royalBlacksmith data is absent", () => {
		const data = {} as Parameters<typeof findRoyalBlacksmithItem>[1];
		expect(findRoyalBlacksmithItem(fakePlayer, data, makeReaction(0, 0))).toBeNull();
	});

	it("returns null when status is not ready", () => {
		const data = {
			royalBlacksmith: {
				status: "not_worthy",
				playerLevel: 50,
				upgradeableItems: [],
				playerMoney: 0,
				playerGems: 0
			}
		} as Parameters<typeof findRoyalBlacksmithItem>[1];
		expect(findRoyalBlacksmithItem(fakePlayer, data, makeReaction(0, 0))).toBeNull();
	});

	it("returns null when slot+category combination is not listed", () => {
		const data = {
			royalBlacksmith: {
				status: "ready",
				playerLevel: 100,
				upgradeableItems: [makeRoyalItem(0, 0)],
				playerMoney: 100_000,
				playerGems: 100
			}
		} as Parameters<typeof findRoyalBlacksmithItem>[1];
		expect(findRoyalBlacksmithItem(fakePlayer, data, makeReaction(1, 0))).toBeNull();
		expect(findRoyalBlacksmithItem(fakePlayer, data, makeReaction(0, 1))).toBeNull();
	});

	it("returns the matching item when slot+category match a ready listing", () => {
		const target = makeRoyalItem(2, 1);
		const data = {
			royalBlacksmith: {
				status: "ready",
				playerLevel: 100,
				upgradeableItems: [makeRoyalItem(0, 0), target, makeRoyalItem(3, 0)],
				playerMoney: 100_000,
				playerGems: 100
			}
		} as Parameters<typeof findRoyalBlacksmithItem>[1];
		expect(findRoyalBlacksmithItem(fakePlayer, data, makeReaction(2, 1))).toBe(target);
	});
});

describe("handleRoyalBlacksmithUpgradeReaction", () => {
	/*
	 * Real item data: the rare weapon 11 upgraded to level 5 costs round(7500 * (1 + (RARE - EPIC) * 9%)) = 6150 coins
	 * and 4 gems, and needs the materials 35 x2, 1 x2, 82 x2, 7 x2, 34, 53 x3, 13 x2, 28 x2 and 83
	 */
	const RARE_WEAPON_ID = 11;
	const COMMON_WEAPON_ID = 2;
	const UPGRADE_PRICE = 6150;
	const GEM_PRICE = 4;
	const ALL_MATERIALS = new Map([[35, 2], [1, 2], [82, 2], [7, 2], [34, 1], [53, 3], [13, 2], [28, 2], [83, 1]]);

	// Missing the material 83, a rare material sold 3650 coins
	const MISSING_ONE_RARE = new Map([...ALL_MATERIALS, [83, 0]]);
	const ONE_RARE_PRICE = 3650;

	const logs = crowniclesInstance?.logsDatabase;

	type Slot = InventorySlot & { save: ReturnType<typeof vi.fn> };

	type LockedMissionsInfo = {
		playerId: number;
		gems: number;
		spendGems: ReturnType<typeof vi.fn>;
	};

	function weapon(itemId = RARE_WEAPON_ID): Slot {
		return Object.assign(makeInventorySlot({
			slot: 0, itemCategory: ItemCategory.WEAPON, itemId, itemLevel: RoyalBlacksmithConstants.TARGET_LEVEL - 1
		}), { save: vi.fn().mockResolvedValue(undefined) });
	}

	function makeMissionsInfo(gems: number): LockedMissionsInfo {
		const missionsInfo: LockedMissionsInfo = {
			playerId: 1,
			gems,
			spendGems: vi.fn((amount: number) => {
				missionsInfo.gems -= amount;
				return Promise.resolve();
			})
		};
		return missionsInfo;
	}

	async function openRoyal(player: CityHandlerPlayer, slot: Slot, materials: Map<number, number>, gems: number): Promise<ReactionCollectorCityData> {
		vi.mocked(PlayerMissionsInfos.getOfPlayer).mockResolvedValue({ gems } as PlayerMissionsInfo);
		vi.mocked(Materials.getPlayerMaterials).mockResolvedValue([...materials].map(([materialId, quantity]) => ({
			materialId, quantity
		})) as Awaited<ReturnType<typeof Materials.getPlayerMaterials>>);

		// The royal blacksmith handler only reads the royal blacksmith part of the city data
		return { royalBlacksmith: await buildRoyalBlacksmithData([slot], materials, asPlayer(player)) } as ReactionCollectorCityData;
	}

	function lockRows(player: CityHandlerPlayer, missionsInfo: LockedMissionsInfo, slot: Slot): void {
		const resolve = lockedEntitiesOf([[Player, player.id, player], [PlayerMissionsInfo, player.id, missionsInfo]]);
		vi.mocked(withLockedEntities).mockImplementation((keys, callback) => callback(resolve(keys) as never));
		vi.mocked(InventorySlots.getOfPlayer).mockResolvedValue([slot]);
	}

	async function upgrade(player: CityHandlerPlayer, data: ReactionCollectorCityData, buyMaterials: boolean): Promise<CrowniclesPacket[]> {
		const response: CrowniclesPacket[] = [];
		await handleRoyalBlacksmithUpgradeReaction(asPlayer(player), {
			slot: 0, itemCategory: ItemCategory.WEAPON, buyMaterials
		}, data, response);
		return response;
	}

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(Materials.consumeMaterials).mockResolvedValue(true);
		vi.mocked(PlayerBadgesManager.hasBadge).mockResolvedValue(false);
	});

	it("consumes the materials, debits the listed money and gems and brings the item to the target level", async () => {
		const player = makeHandlerPlayer(UPGRADE_PRICE, RoyalBlacksmithConstants.MIN_PLAYER_LEVEL);
		const missionsInfo = makeMissionsInfo(GEM_PRICE);
		const slot = weapon();
		const data = await openRoyal(player, slot, ALL_MATERIALS, GEM_PRICE);
		lockRows(player, missionsInfo, slot);

		const response = await upgrade(player, data, false);

		expect(Materials.consumeMaterials).toHaveBeenCalledWith(player.id, [...ALL_MATERIALS].map(([materialId, quantity]) => ({
			materialId, quantity
		})));
		expect(player.spendMoney).toHaveBeenCalledWith({
			response, amount: UPGRADE_PRICE, reason: NumberChangeReason.ROYAL_BLACKSMITH_UPGRADE
		});
		expect(missionsInfo.spendGems).toHaveBeenCalledWith(GEM_PRICE, response, NumberChangeReason.ROYAL_BLACKSMITH_UPGRADE_GEMS);
		expect([player.money, missionsInfo.gems]).toEqual([0, 0]);
		expect(slot.itemLevel).toBe(RoyalBlacksmithConstants.TARGET_LEVEL);
		expect(slot.save).toHaveBeenCalled();
		expect(player.save).toHaveBeenCalled();
		expect(describePackets(response)).toEqual([["CommandReportRoyalBlacksmithUpgradeRes", {
			itemCategory: ItemCategory.WEAPON, upgradeCost: UPGRADE_PRICE, materialsCost: 0, gemCost: GEM_PRICE, boughtMaterials: false
		}]]);
		expect(MissionsController.update).toHaveBeenCalledWith(player, response, {
			missionId: "upgradeEpicItemLevel5", params: {
				rarity: ItemRarity.RARE, newLevel: RoyalBlacksmithConstants.TARGET_LEVEL
			}
		});
		expect(PlayerBadgesManager.addBadge).not.toHaveBeenCalled();
		expect(logs?.logBlacksmithUpgrade).toHaveBeenCalledWith({
			keycloakId: player.keycloakId,
			cityId: "boug_coton",
			itemCategory: ItemCategory.WEAPON,
			slot: 0,
			fromLevel: RoyalBlacksmithConstants.TARGET_LEVEL - 1,
			toLevel: RoyalBlacksmithConstants.TARGET_LEVEL,
			totalCost: UPGRADE_PRICE,
			boughtMaterials: false,
			materialsCost: null
		});
	});

	it("sells the missing materials at the menu price on top of the upgrade", async () => {
		const total = UPGRADE_PRICE + ONE_RARE_PRICE;
		const player = makeHandlerPlayer(total, RoyalBlacksmithConstants.MIN_PLAYER_LEVEL);
		const missionsInfo = makeMissionsInfo(GEM_PRICE);
		const slot = weapon();
		const data = await openRoyal(player, slot, MISSING_ONE_RARE, GEM_PRICE);
		lockRows(player, missionsInfo, slot);

		const response = await upgrade(player, data, true);

		expect(data.royalBlacksmith?.upgradeableItems[0].missingMaterialsCost).toBe(ONE_RARE_PRICE);
		expect(player.money).toBe(0);
		expect(response[0]).toMatchObject({
			materialsCost: ONE_RARE_PRICE, boughtMaterials: true
		});
		expect(vi.mocked(Materials.consumeMaterials).mock.calls[0][1]).not.toContainEqual(expect.objectContaining({ materialId: 83 }));
		expect(logs?.logBlacksmithUpgrade).toHaveBeenCalledWith(expect.objectContaining({
			totalCost: total, boughtMaterials: true, materialsCost: ONE_RARE_PRICE
		}));
	});

	it("awards the sentimental badge for a low rarity item, and mocks a player who already has it", async () => {
		const player = makeHandlerPlayer(1_000_000, RoyalBlacksmithConstants.MIN_PLAYER_LEVEL);
		const firstSlot = weapon(COMMON_WEAPON_ID);
		const data = await openRoyal(player, firstSlot, new Map(), 100);
		lockRows(player, makeMissionsInfo(100), firstSlot);
		const first = await upgrade(player, data, true);
		vi.mocked(PlayerBadgesManager.hasBadge).mockResolvedValue(true);
		const secondSlot = weapon(COMMON_WEAPON_ID);
		lockRows(player, makeMissionsInfo(100), secondSlot);
		const second = await upgrade(player, data, true);

		expect(PlayerBadgesManager.addBadge).toHaveBeenCalledTimes(1);
		expect(PlayerBadgesManager.addBadge).toHaveBeenCalledWith(player.id, Badge.SENTIMENTAL_CRAFTER);
		expect(describePackets(first).map(([name]) => name)).toContain("CommandReportRoyalBlacksmithMockBadgeGivenRes");
		expect(describePackets(second).map(([name]) => name)).toContain("CommandReportRoyalBlacksmithMockBadgeAlreadyOwnedRes");
	});

	it("refuses before locking when money is missing or materials are missing and not bought", async () => {
		const player = makeHandlerPlayer(UPGRADE_PRICE + ONE_RARE_PRICE - 3, RoyalBlacksmithConstants.MIN_PLAYER_LEVEL);
		const data = await openRoyal(player, weapon(), MISSING_ONE_RARE, GEM_PRICE);

		const poor = await upgrade(player, data, true);
		const notBought = await upgrade(player, data, false);

		expect(describePackets(poor)).toEqual([["CommandReportRoyalBlacksmithNotEnoughMoneyRes", { missingMoney: 3 }]]);
		expect(describePackets(notBought)).toEqual([["CommandReportRoyalBlacksmithMissingMaterialsRes", {}]]);
		expect(withLockedEntities).not.toHaveBeenCalled();
	});

	it("re-checks the locked rows: no upgrade when money or gems were spent meanwhile", async () => {
		const player = makeHandlerPlayer(UPGRADE_PRICE, RoyalBlacksmithConstants.MIN_PLAYER_LEVEL);
		const slot = weapon();
		const data = await openRoyal(player, slot, ALL_MATERIALS, GEM_PRICE);
		const poorPlayer = makeHandlerPlayer(UPGRADE_PRICE - 1, RoyalBlacksmithConstants.MIN_PLAYER_LEVEL);
		lockRows(poorPlayer, makeMissionsInfo(GEM_PRICE), slot);
		const poor = await upgrade(player, data, false);
		lockRows(player, makeMissionsInfo(GEM_PRICE - 2), slot);
		const noGems = await upgrade(player, data, false);

		expect(describePackets(poor)).toEqual([["CommandReportRoyalBlacksmithNotEnoughMoneyRes", { missingMoney: 1 }]]);
		expect(describePackets(noGems)).toEqual([["CommandReportRoyalBlacksmithNotEnoughGemsRes", { missingGems: 2 }]]);
		expect(Materials.consumeMaterials).not.toHaveBeenCalled();
		expect(slot.itemLevel).toBe(RoyalBlacksmithConstants.TARGET_LEVEL - 1);
	});

	it("neither debits nor upgrades when the materials were consumed meanwhile or the slot changed", async () => {
		const player = makeHandlerPlayer(UPGRADE_PRICE, RoyalBlacksmithConstants.MIN_PLAYER_LEVEL);
		const slot = weapon();
		const data = await openRoyal(player, slot, ALL_MATERIALS, GEM_PRICE);
		lockRows(player, makeMissionsInfo(GEM_PRICE), slot);
		vi.mocked(Materials.consumeMaterials).mockResolvedValue(false);
		const consumed = await upgrade(player, data, false);
		const changedSlot = Object.assign(weapon(), { itemLevel: RoyalBlacksmithConstants.TARGET_LEVEL });
		lockRows(player, makeMissionsInfo(GEM_PRICE), changedSlot);
		const changed = await upgrade(player, data, false);

		expect(describePackets(consumed)).toEqual([["CommandReportRoyalBlacksmithMissingMaterialsRes", {}]]);
		expect(describePackets(changed)).toEqual([["CommandReportEquipmentChangedRes", {}]]);
		expect(player.spendMoney).not.toHaveBeenCalled();
		expect(slot.itemLevel).toBe(RoyalBlacksmithConstants.TARGET_LEVEL - 1);
	});

	it("does not log an upgrade made outside of a city and ignores an unlisted item", async () => {
		const player = makeHandlerPlayer(UPGRADE_PRICE, RoyalBlacksmithConstants.MIN_PLAYER_LEVEL);
		player.getCurrentCityId.mockReturnValue(null);
		const slot = weapon();
		const data = await openRoyal(player, slot, ALL_MATERIALS, GEM_PRICE);
		lockRows(player, makeMissionsInfo(GEM_PRICE), slot);
		const unlisted = await upgrade(player, {} as ReactionCollectorCityData, false);

		await upgrade(player, data, false);

		expect(unlisted).toEqual([]);
		expect(slot.itemLevel).toBe(RoyalBlacksmithConstants.TARGET_LEVEL);
		expect(logs?.logBlacksmithUpgrade).not.toHaveBeenCalled();
	});
});
