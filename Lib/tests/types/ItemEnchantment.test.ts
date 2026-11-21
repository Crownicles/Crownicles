import {
	afterEach, describe, expect, it, vi
} from "vitest";
import {
	ItemEnchantment, ItemEnchantmentKind
} from "../../src/types/ItemEnchantment";
import { ItemCategory } from "../../src/constants/ItemConstants";
import { EnchantmentConstants } from "../../src/constants/EnchantmentConstants";
import { RandomUtils } from "../../src/utils/RandomUtils";

function rollAt(value: number): void {
	vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(value);
}

describe("ItemEnchantment lookup", () => {
	it("finds an enchantment by its id", () => {
		expect(ItemEnchantment.getById("pvpAttack2")).toBe(ItemEnchantment.PVP_ATTACK_2);
		expect(ItemEnchantment.getById("unknown")).toBeNull();
	});

	it("lists every declared enchantment once", () => {
		const all = ItemEnchantment.getAllEnchantments();

		expect(all).toContain(ItemEnchantment.POISONED_DAMAGE_1);
		expect(new Set(all.map(enchantment => enchantment.id)).size).toBe(all.length);
		expect(all).toHaveLength(Object.values(ItemEnchantment).filter(value => value instanceof ItemEnchantment).length);
	});
});

describe("ItemEnchantment weights", () => {
	it.each([0, 9])("refuses a probability weight of %i", weight => {
		expect(() => new ItemEnchantment("invalid", ItemEnchantmentKind.DEFENSE, 1, weight)).toThrow("Probability weight must be between 1 and 8");
	});

	it("accepts the extreme probability weights", () => {
		expect(new ItemEnchantment("rarest", ItemEnchantmentKind.DEFENSE, 1, 1).probabilityWeight).toBe(1);
		expect(new ItemEnchantment("commonest", ItemEnchantmentKind.DEFENSE, 1, 8).probabilityWeight).toBe(8);
	});
});

describe("ItemEnchantment random draw", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("draws the first enchantment with the lowest roll and the last one with the highest roll", () => {
		const all = ItemEnchantment.getAllEnchantments();

		rollAt(0);
		expect(ItemEnchantment.getRandomEnchantment()).toBe(all[0]);

		rollAt(0.999_999);
		expect(ItemEnchantment.getRandomEnchantment()).toBe(all[all.length - 1]);
	});

	it("moves to the next enchantment when the roll reaches the end of a weight", () => {
		const all = ItemEnchantment.getAllEnchantments();
		const totalWeight = all.reduce((sum, enchantment) => sum + enchantment.probabilityWeight, 0);

		// The two first weights end on a roll that the multiplication by the total weight gives back exactly
		rollAt((all[0].probabilityWeight + all[1].probabilityWeight) / totalWeight);

		expect(ItemEnchantment.getRandomEnchantment()).toBe(all[2]);
	});

	it("fails loudly when the roll exceeds the total weight", () => {
		rollAt(1.5);

		expect(() => ItemEnchantment.getRandomEnchantment()).toThrow("Failed to select a random enchantment");
	});

	it("only draws enchantments of the given slot", () => {
		for (const slot of [ItemCategory.WEAPON, ItemCategory.ARMOR] as const) {
			const pool = ItemEnchantment.getAllEnchantments().filter(enchantment => enchantment.kind.slot === slot);
			rollAt(0);
			expect(ItemEnchantment.getRandomEnchantmentForSlot(slot)).toBe(pool[0]);
			rollAt(0.999_999);
			expect(ItemEnchantment.getRandomEnchantmentForSlot(slot)).toBe(pool[pool.length - 1]);
		}
	});
});

describe("ItemEnchantment.getEnchantmentCost", () => {
	it("prices an enchantment according to its rarity", () => {
		expect(ItemEnchantment.MAX_ENERGY_3.getEnchantmentCost(false)).toEqual({
			money: EnchantmentConstants.PROBABILITY_WEIGHT_TO_COST.MONEY[0],
			gems: EnchantmentConstants.PROBABILITY_WEIGHT_TO_COST.GEMS[0]
		});
		expect(ItemEnchantment.ALL_ATTACK_1.getEnchantmentCost(false)).toEqual({
			money: EnchantmentConstants.PROBABILITY_WEIGHT_TO_COST.MONEY[7],
			gems: EnchantmentConstants.PROBABILITY_WEIGHT_TO_COST.GEMS[7]
		});
	});

	it("gives a rounded discount to the mages", () => {
		// Weight 5 costs 5000 coins and 9 gems
		expect(ItemEnchantment.MAX_ENERGY_1.getEnchantmentCost(true)).toEqual({
			money: 4000,
			gems: 7
		});
	});
});
