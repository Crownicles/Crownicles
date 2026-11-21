import {
	afterEach, describe, expect, it, vi
} from "vitest";
import {
	generateRandomItem, generateRandomRarity
} from "../../../src/core/utils/ItemUtils";
import {
	ItemCategory, ItemNature, ItemRarity
} from "../../../../Lib/src/constants/ItemConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { WeaponDataController } from "../../../src/data/Weapon";

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
				expect(item.getCategory()).toBe(ItemCategory.POTION);
				expect(item.nature).toBe(ItemNature.TIME_SPEEDUP);
			}
		});

		it("should throw error when no item exists with the criteria", () => {
			// Use a non-existent ItemNature value with a broad rarity range so no items match
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

describe("generateRandomItem with missing rarities", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	/**
	 * Pretend the weapon data has no item of the given rarity
	 */
	function removeWeaponRarity(missingRarity: ItemRarity): void {
		const controller = WeaponDataController.instance;
		const getAllIdsForRarity = controller.getAllIdsForRarity.bind(controller);
		vi.spyOn(controller, "getAllIdsForRarity").mockImplementation(rarity => (rarity === missingRarity ? [] : getAllIdsForRarity(rarity)));
	}

	it("should describe the criteria when no item has the requested rarity", () => {
		removeWeaponRarity(ItemRarity.EPIC);

		expect(() => generateRandomItem({
			itemCategory: ItemCategory.WEAPON,
			minRarity: ItemRarity.EPIC,
			maxRarity: ItemRarity.EPIC
		})).toThrow(new Error(`No item exists with criteria: category: ${ItemCategory.WEAPON}, rarity: [${ItemRarity.EPIC}-${ItemRarity.EPIC}]`));
	});

	it("should mention the subType in the error when one was requested", () => {
		expect(() => generateRandomItem({
			itemCategory: ItemCategory.POTION,
			subType: 99 as ItemNature,
			minRarity: ItemRarity.RARE,
			maxRarity: ItemRarity.EPIC
		})).toThrow(new Error(`No item exists with criteria: category: ${ItemCategory.POTION}, rarity: [${ItemRarity.RARE}-${ItemRarity.EPIC}], subType: 99`));
	});

	it("should draw again when the drawn rarity has no item", () => {
		removeWeaponRarity(ItemRarity.EPIC);
		// 9950 draws EPIC (missing), 9500 draws SPECIAL, then the item index
		vi.spyOn(RandomUtils.crowniclesRandom, "integer")
			.mockReturnValueOnce(9950)
			.mockReturnValueOnce(9500)
			.mockReturnValueOnce(0);

		const item = generateRandomItem({
			itemCategory: ItemCategory.WEAPON,
			minRarity: ItemRarity.SPECIAL,
			maxRarity: ItemRarity.LEGENDARY
		});

		expect(item.rarity).toBe(ItemRarity.SPECIAL);
	});
});

describe("generateRandomRarity draws", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should draw in the whole generator range by default", () => {
		const integer = vi.spyOn(RandomUtils.crowniclesRandom, "integer").mockReturnValue(1);

		generateRandomRarity();

		expect(integer).toHaveBeenCalledWith(0, 10000);
	});

	it("should restrict the draw to the generator values of the rarity bounds", () => {
		const integer = vi.spyOn(RandomUtils.crowniclesRandom, "integer").mockReturnValue(4376);

		generateRandomRarity(ItemRarity.UNCOMMON, ItemRarity.EPIC);

		expect(integer).toHaveBeenCalledWith(4376, 9975);
	});

	it.each([
		[4375, ItemRarity.COMMON],
		[4376, ItemRarity.UNCOMMON],
		[9975, ItemRarity.EPIC],
		[9976, ItemRarity.LEGENDARY],
		[10000, ItemRarity.MYTHICAL]
	])("should map the draw %s to the rarity %s", (draw, rarity) => {
		vi.spyOn(RandomUtils.crowniclesRandom, "integer").mockReturnValue(draw);

		expect(generateRandomRarity()).toBe(rarity);
	});
});
