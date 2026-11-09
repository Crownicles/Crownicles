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

import { buildScrapDealerData } from "../../../src/core/report/ReportCityScrapDealerService";
import InventorySlot from "../../../src/core/database/game/models/InventorySlot";
import { Player } from "../../../src/core/database/game/models/Player";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";

function makeSlot(itemCategory: ItemCategory, slot: number, itemEnchantmentId: string | null): InventorySlot {
	return {
		slot,
		itemCategory,
		itemId: 12,
		itemLevel: 2,
		itemEnchantmentId,
		isEquipped: () => slot === 0,
		isPrimaryEquipment: () => itemCategory === ItemCategory.WEAPON || itemCategory === ItemCategory.ARMOR,
		isWeapon: () => itemCategory === ItemCategory.WEAPON,
		itemWithDetails: () => ({
			id: 12, itemLevel: 2
		})
	} as never;
}

describe("buildScrapDealerData enchanted items", () => {
	it("names the enchanted reserve equipment the scrap dealer refuses, leaving what is equipped aside", () => {
		const data = buildScrapDealerData([
			makeSlot(ItemCategory.WEAPON, 0, "attack1"),
			makeSlot(ItemCategory.ARMOR, 1, "defense1"),
			makeSlot(ItemCategory.WEAPON, 1, null),
			makeSlot(ItemCategory.OBJECT, 1, "defense1")
		], { money: 0 } as Player);

		expect(data.enchantedItems.map(item => ({
			slot: item.slot, category: item.category
		}))).toEqual([
			{
				slot: 1, category: ItemCategory.ARMOR
			}
		]);
	});
});
