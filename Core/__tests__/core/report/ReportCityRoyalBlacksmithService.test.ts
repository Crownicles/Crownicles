import {
	describe, expect, it, vi
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

import {
	buildExecutionData, findRoyalBlacksmithItem
} from "../../../src/core/report/ReportCityRoyalBlacksmithService";
import { ReactionCollectorRoyalBlacksmithUpgradeReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { Player } from "../../../src/core/database/game/models/Player";

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
