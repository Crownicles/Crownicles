import {
	describe, expect, it
} from "vitest";
import {
	getCookingGrade, COOKING_GRADES, CookingXpConstants,
	GASPARD_JO_RECIPE_COSTS, FARMER_RECIPE_COSTS,
	SLOT_CONFIGS, SLOT_SEED_OFFSETS
} from "../../../../Lib/src/constants/CookingConstants";

describe("CookingConstants", () => {
	describe("getCookingGrade", () => {
		it("should return kitchenHelper for level 0", () => {
			expect(getCookingGrade(0).id).toBe("kitchenHelper");
		});

		it("should return kitchenHelper for level 10", () => {
			expect(getCookingGrade(10).id).toBe("kitchenHelper");
		});

		it("should return scullion for level 11", () => {
			expect(getCookingGrade(11).id).toBe("scullion");
		});

		it("should return royalGrandChef for level 91", () => {
			expect(getCookingGrade(91).id).toBe("royalGrandChef");
		});

		it("should return royalGrandChef for very high levels", () => {
			expect(getCookingGrade(500).id).toBe("royalGrandChef");
		});

		it("should return the last grade as fallback for unreachable levels", () => {
			// getCookingGrade should always return a valid grade
			const grade = getCookingGrade(999);
			expect(grade).toBeDefined();
			expect(grade.id).toBe("royalGrandChef");
		});
	});

	describe("grade boundaries", () => {
		it("should have no gaps between grade level ranges", () => {
			for (let i = 1; i < COOKING_GRADES.length; i++) {
				expect(COOKING_GRADES[i].minLevel).toBe(COOKING_GRADES[i - 1].maxLevel + 1);
			}
		});

		it("should start at level 0", () => {
			expect(COOKING_GRADES[0].minLevel).toBe(0);
		});

		it("should end at Infinity", () => {
			expect(COOKING_GRADES[COOKING_GRADES.length - 1].maxLevel).toBe(Infinity);
		});

		it("should have 10 grades total", () => {
			expect(COOKING_GRADES).toHaveLength(10);
		});

		it("every grade should have non-negative failureRate", () => {
			for (const grade of COOKING_GRADES) {
				expect(grade.failureRate).toBeGreaterThanOrEqual(0);
				expect(grade.failureRate).toBeLessThanOrEqual(1);
			}
		});

		it("every grade should have non-negative secretRecipeRate", () => {
			for (const grade of COOKING_GRADES) {
				expect(grade.secretRecipeRate).toBeGreaterThanOrEqual(0);
				expect(grade.secretRecipeRate).toBeLessThanOrEqual(1);
			}
		});

		it("every grade should have non-negative materialSaveChance and woodSaveChance", () => {
			for (const grade of COOKING_GRADES) {
				expect(grade.materialSaveChance).toBeGreaterThanOrEqual(0);
				expect(grade.woodSaveChance).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe("slot configs", () => {
		it("should have same count as seed offsets", () => {
			expect(SLOT_CONFIGS.length).toBe(SLOT_SEED_OFFSETS.length);
		});

		it("each slot should have valid level range", () => {
			for (const config of SLOT_CONFIGS) {
				expect(config.minLevel).toBeLessThanOrEqual(config.maxLevel);
				expect(config.minLevel).toBeGreaterThanOrEqual(1);
			}
		});

		it("each slot should have at least one eligible type", () => {
			for (const config of SLOT_CONFIGS) {
				expect(config.eligibleTypes.length).toBeGreaterThan(0);
			}
		});
	});

	describe("progressive costs", () => {
		it("GASPARD_JO_RECIPE_COSTS should be strictly increasing", () => {
			for (let i = 1; i < GASPARD_JO_RECIPE_COSTS.length; i++) {
				expect(GASPARD_JO_RECIPE_COSTS[i]).toBeGreaterThan(GASPARD_JO_RECIPE_COSTS[i - 1]);
			}
		});

		it("FARMER_RECIPE_COSTS should be strictly increasing", () => {
			for (let i = 1; i < FARMER_RECIPE_COSTS.length; i++) {
				expect(FARMER_RECIPE_COSTS[i]).toBeGreaterThan(FARMER_RECIPE_COSTS[i - 1]);
			}
		});

		it("first cost should be affordable for new players", () => {
			expect(GASPARD_JO_RECIPE_COSTS[0]).toBeLessThanOrEqual(50);
			expect(FARMER_RECIPE_COSTS[0]).toBeLessThanOrEqual(50);
		});
	});

	describe("xp constants", () => {
		it("should have positive weights summing to 1", () => {
			expect(CookingXpConstants.PLANT_WEIGHT).toBeGreaterThan(0);
			expect(CookingXpConstants.MATERIAL_WEIGHT).toBeGreaterThan(0);
			expect(CookingXpConstants.PLANT_WEIGHT + CookingXpConstants.MATERIAL_WEIGHT).toBe(1);
		});

		it("should have positive failure XP per level", () => {
			expect(CookingXpConstants.FAILURE_XP_PER_LEVEL).toBeGreaterThan(0);
		});
	});
});
