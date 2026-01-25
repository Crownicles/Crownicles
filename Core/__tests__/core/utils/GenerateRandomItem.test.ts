import {
	beforeAll, describe, expect, it
} from "vitest";
import {
	generateRandomItem, generateRandomRarity
} from "../../../src/core/utils/ItemUtils";
import {
	ItemCategory, ItemNature, ItemRarity
} from "../../../../Lib/src/constants/ItemConstants";

describe("generateRandomItem", () => {
	describe("rarity validation", () => {
		it("should throw error when minRarity > maxRarity", () => {
			expect(() => generateRandomItem({
				itemCategory: ItemCategory.WEAPON,
				minRarity: ItemRarity.LEGENDARY,
				maxRarity: ItemRarity.COMMON
			})).toThrow(/Invalid rarity range: minRarity \(\d+\) > maxRarity \(\d+\)/);
		});

		it("should accept valid rarity range", () => {
			const item = generateRandomItem({
				itemCategory: ItemCategory.WEAPON,
				minRarity: ItemRarity.COMMON,
				maxRarity: ItemRarity.RARE
			});
			expect(item).toBeDefined();
			expect(item.rarity).toBeGreaterThanOrEqual(ItemRarity.COMMON);
			expect(item.rarity).toBeLessThanOrEqual(ItemRarity.RARE);
		});

		it("should accept same min and max rarity", () => {
			const item = generateRandomItem({
				itemCategory: ItemCategory.WEAPON,
				minRarity: ItemRarity.RARE,
				maxRarity: ItemRarity.RARE
			});
			expect(item).toBeDefined();
			expect(item.rarity).toBe(ItemRarity.RARE);
		});
	});

	describe("available rarities filtering", () => {
		it("should only generate items with available rarities for potions with subType", () => {
			// Generate multiple items to verify only valid rarities are produced
			for (let i = 0; i < 10; i++) {
				const item = generateRandomItem({
					itemCategory: ItemCategory.POTION,
					subType: ItemNature.TIME_SPEEDUP,
					minRarity: ItemRarity.COMMON,
					maxRarity: ItemRarity.MYTHICAL
				});
				expect(item).toBeDefined();
				expect(item.rarity).toBeGreaterThanOrEqual(ItemRarity.COMMON);
			}
		});

		it("should throw error when no item exists with the criteria", () => {
			// ItemNature.NONE with high rarity range - likely no items exist
			expect(() => generateRandomItem({
				itemCategory: ItemCategory.POTION,
				subType: 999 as ItemNature, // Non-existent nature
				minRarity: ItemRarity.COMMON,
				maxRarity: ItemRarity.MYTHICAL
			})).toThrow(/No item exists with criteria/);
		});
	});

	describe("category handling", () => {
		it("should generate weapon when category is WEAPON", () => {
			const item = generateRandomItem({
				itemCategory: ItemCategory.WEAPON
			});
			expect(item).toBeDefined();
			expect(item.getCategory()).toBe(ItemCategory.WEAPON);
		});

		it("should generate armor when category is ARMOR", () => {
			const item = generateRandomItem({
				itemCategory: ItemCategory.ARMOR
			});
			expect(item).toBeDefined();
			expect(item.getCategory()).toBe(ItemCategory.ARMOR);
		});

		it("should generate potion when category is POTION", () => {
			const item = generateRandomItem({
				itemCategory: ItemCategory.POTION
			});
			expect(item).toBeDefined();
			expect(item.getCategory()).toBe(ItemCategory.POTION);
		});

		it("should generate object when category is OBJECT", () => {
			const item = generateRandomItem({
				itemCategory: ItemCategory.OBJECT
			});
			expect(item).toBeDefined();
			expect(item.getCategory()).toBe(ItemCategory.OBJECT);
		});
	});
});

describe("generateRandomRarity", () => {
	it("should generate rarity within specified range", () => {
		for (let i = 0; i < 100; i++) {
			const rarity = generateRandomRarity(ItemRarity.COMMON, ItemRarity.RARE);
			expect(rarity).toBeGreaterThanOrEqual(ItemRarity.COMMON);
			expect(rarity).toBeLessThanOrEqual(ItemRarity.RARE);
		}
	});

	it("should return exact rarity when min equals max", () => {
		for (let i = 0; i < 10; i++) {
			const rarity = generateRandomRarity(ItemRarity.EPIC, ItemRarity.EPIC);
			expect(rarity).toBe(ItemRarity.EPIC);
		}
	});
});
