import {
	describe, expect, it, vi
} from "vitest";

vi.mock("../../../src/data/Weapon", () => ({
	WeaponDataController: {
		instance: {
			getById: (): object => ({
				rarity: 3, getUpgradeMaterials: (): [] => []
			})
		}
	}
}));
vi.mock("../../../src/data/Armor", () => ({
	ArmorDataController: {
		instance: {
			getById: (): object => ({
				rarity: 3, getUpgradeMaterials: (): [] => []
			})
		}
	}
}));

import { buildBlacksmithData } from "../../../src/core/report/ReportBlacksmithService";
import InventorySlot from "../../../src/core/database/game/models/InventorySlot";
import { Player } from "../../../src/core/database/game/models/Player";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import {
	BLACKSMITH_LIMITS, BlacksmithConstants, RoyalBlacksmithConstants
} from "../../../../Lib/src/constants/BlacksmithConstants";

function makeSlot(itemCategory: ItemCategory, slot: number, itemLevel: number, itemId = 12): InventorySlot {
	return {
		slot,
		itemCategory,
		itemId,
		itemLevel,
		itemEnchantmentId: null,
		isPrimaryEquipment: () => (itemCategory === ItemCategory.WEAPON || itemCategory === ItemCategory.ARMOR) && itemId !== 0,
		isWeapon: () => itemCategory === ItemCategory.WEAPON,
		itemWithDetails: () => ({
			id: itemId, itemLevel
		})
	} as never;
}

const player = { money: 0 } as Player;

describe("buildBlacksmithData beyond reach items", () => {
	it("lays on the anvil the equipment the blacksmith can no longer upgrade, with the reason", () => {
		const data = buildBlacksmithData([
			makeSlot(ItemCategory.WEAPON, 0, BlacksmithConstants.MAX_UPGRADE_LEVEL - 1),
			makeSlot(ItemCategory.ARMOR, 0, BlacksmithConstants.MAX_UPGRADE_LEVEL),
			makeSlot(ItemCategory.WEAPON, 1, RoyalBlacksmithConstants.TARGET_LEVEL)
		], new Map(), player);

		expect(data.upgradeableItems.map(item => item.category)).toEqual([ItemCategory.WEAPON]);
		expect(data.beyondReachItems.map(item => ({
			slot: item.slot, category: item.category, limit: item.limit
		}))).toEqual([
			{
				slot: 0, category: ItemCategory.ARMOR, limit: BLACKSMITH_LIMITS.ROYAL_ONLY
			},
			{
				slot: 1, category: ItemCategory.WEAPON, limit: BLACKSMITH_LIMITS.MAXED
			}
		]);
	});

	it("leaves out empty equipment slots and other item kinds", () => {
		const data = buildBlacksmithData([
			makeSlot(ItemCategory.WEAPON, 0, BlacksmithConstants.MAX_UPGRADE_LEVEL, 0),
			makeSlot(ItemCategory.OBJECT, 0, BlacksmithConstants.MAX_UPGRADE_LEVEL)
		], new Map(), player);

		expect(data.beyondReachItems).toEqual([]);
	});
});
