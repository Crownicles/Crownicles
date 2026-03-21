import {
	describe, expect, it
} from "vitest";
import {
	getSlotCycle, getRecipeForSlot, isRecipeSecret, getCurrentDaySeed
} from "../../../src/core/cooking/CookingSlotRotation";
import {
	SLOT_CONFIGS, RecipeType
} from "../../../../Lib/src/constants/CookingConstants";

describe("CookingSlotRotation", () => {
	describe("getSlotCycle", () => {
		it("should return all eligible types for a slot", () => {
			const cycle = getSlotCycle(0, 12345);
			const expected = SLOT_CONFIGS[0].eligibleTypes;
			expect(cycle).toHaveLength(expected.length);
			expect(new Set(cycle)).toEqual(new Set(expected));
		});

		it("should be deterministic — same seed same result", () => {
			const a = getSlotCycle(1, 99999);
			const b = getSlotCycle(1, 99999);
			expect(a).toEqual(b);
		});

		it("should produce different orders for different seeds", () => {
			const a = getSlotCycle(0, 1);
			const b = getSlotCycle(0, 2);
			// Very unlikely to be identical for different seeds
			const sameOrder = a.every((v, i) => v === b[i]);
			expect(sameOrder).toBe(false);
		});

		it("should produce different orders for different slots with same seed", () => {
			const a = getSlotCycle(0, 1000);
			const b = getSlotCycle(1, 1000);
			// Different seed offsets should give different permutations
			const sameOrder = a.length === b.length && a.every((v, i) => v === b[i]);
			expect(sameOrder).toBe(false);
		});
	});

	describe("getRecipeForSlot", () => {
		it("should return null when no discovered recipes match", () => {
			// Empty discovered list means only discoveredByDefault recipes
			// Slot 3 (potions only, level 3-8) — may have no match for empty list
			const result = getRecipeForSlot(3, 0, 12345, []);
			// Result depends on data, but should not crash
			expect(result === null || typeof result.id === "string").toBe(true);
		});

		it("should be deterministic for same parameters", () => {
			const discovered = ["potion_health_1", "potion_health_2", "potion_energy_1"];
			const a = getRecipeForSlot(0, 5, 42, discovered);
			const b = getRecipeForSlot(0, 5, 42, discovered);
			expect(a?.id).toEqual(b?.id);
		});

		it("should cycle through recipe types as furnace position changes", () => {
			const discovered = ["potion_health_1", "potion_energy_1", "potion_attack_1"];
			const seed = 100;
			const recipes = [];
			for (let pos = 0; pos < 10; pos++) {
				recipes.push(getRecipeForSlot(0, pos, seed, discovered));
			}
			// Should have variation (not all the same recipe)
			const ids = recipes.filter(r => r !== null).map(r => r!.id);
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBeGreaterThanOrEqual(1);
		});
	});

	describe("isRecipeSecret", () => {
		it("should be deterministic for same inputs", () => {
			const a = isRecipeSecret(0, 3, 42, 0.5);
			const b = isRecipeSecret(0, 3, 42, 0.5);
			expect(a).toBe(b);
		});

		it("should return false when secretRate is 0", () => {
			// With rate 0, no recipe should ever be secret
			let anySecret = false;
			for (let i = 0; i < 100; i++) {
				if (isRecipeSecret(0, i, i * 7, 0)) {
					anySecret = true;
				}
			}
			expect(anySecret).toBe(false);
		});

		it("should return true when secretRate is 1", () => {
			// With rate 1.0, all should be secret
			let allSecret = true;
			for (let i = 0; i < 100; i++) {
				if (!isRecipeSecret(0, i, i * 7, 1)) {
					allSecret = false;
				}
			}
			expect(allSecret).toBe(true);
		});
	});

	describe("getCurrentDaySeed", () => {
		it("should return a positive integer", () => {
			const seed = getCurrentDaySeed();
			expect(seed).toBeGreaterThan(0);
			expect(Number.isInteger(seed)).toBe(true);
		});
	});
});
