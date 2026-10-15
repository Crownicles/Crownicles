import {
	describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/data/Weapon", () => ({
	WeaponDataController: {
		instance: {
			getById: (id: number): object => ({
				rarity: id, getUpgradeMaterials: (): [] => []
			})
		}
	}
}));
vi.mock("../../../src/data/Armor", () => ({
	ArmorDataController: {
		instance: {
			getById: (id: number): object => ({
				rarity: id, getUpgradeMaterials: (): [] => []
			})
		}
	}
}));

import { buildUpgradeStationData } from "../../../src/core/report/ReportCityService";
import InventorySlot from "../../../src/core/database/game/models/InventorySlot";
import { Player } from "../../../src/core/database/game/models/Player";
import { HomeLevel } from "../../../../Lib/src/types/HomeLevel";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { HomeConstants } from "../../../../Lib/src/constants/HomeConstants";

/** The item id doubles as its rarity in the mocked data controllers. */
function makeSlot(slot: number, rarity: number, itemLevel: number): InventorySlot {
	return {
		slot,
		itemCategory: ItemCategory.WEAPON,
		itemId: rarity,
		itemLevel,
		isPrimaryEquipment: () => true,
		isWeapon: () => true,
		itemWithDetails: () => ({
			id: rarity, itemLevel
		})
	} as never;
}

const homeLevel = { features: {
	maxItemUpgradeLevel: 2, upgradeItemMaximumRarity: 3
} } as HomeLevel;

describe("buildUpgradeStationData", () => {
	it("hands back what the home is too small for, or what nothing can improve, with the reason", () => {
		const data = buildUpgradeStationData([
			makeSlot(0, 2, 1),
			makeSlot(1, 2, 2),
			makeSlot(2, 5, 0),
			makeSlot(3, 2, 5)
		], new Map(), homeLevel, { money: 0 } as Player);

		expect(data.upgradeableItems.map(item => item.slot)).toEqual([0]);
		expect(data.beyondReachItems.map(item => [item.slot, item.limit])).toEqual([
			[1, HomeConstants.UPGRADE_STATION_LIMITS.HOME_LEVEL],
			[2, HomeConstants.UPGRADE_STATION_LIMITS.RARITY],
			[3, HomeConstants.UPGRADE_STATION_LIMITS.MAXED]
		]);
		expect(data.maxItemLevel).toBe(2);
	});
});
