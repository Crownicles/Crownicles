import {
	describe, expect, it
} from "vitest";
import {
	getCookingGrade, getMinCookingLevelForRecipeLevel, COOKING_GRADES, CookingXpConstants,
	GASPARD_JO_RECIPE_COSTS, FARMER_RECIPE_COSTS,
	SLOT_CONFIGS, SLOT_SEED_OFFSETS, MASTER_CHEF_BADGE_COOKING_LEVEL,
	getCookingSpecialtiesLimit, getNextCookingSpecialtyUnlockLevel
} from "../../../../Lib/src/constants/CookingConstants";

describe("CookingConstants", () => {
	describe("cooking specialties unlock", () => {
		const firstLevelOf = (gradeId: string): number => COOKING_GRADES.find(grade => grade.id === gradeId)!.minLevel;

		it("should unlock one specialty on becoming kitchen master, one on becoming royal grand chef and the last one with the master chef badge", () => {
			expect(getCookingSpecialtiesLimit(firstLevelOf("kitchenMaster") - 1)).toBe(0);
			expect(getCookingSpecialtiesLimit(firstLevelOf("kitchenMaster"))).toBe(1);
			expect(getCookingSpecialtiesLimit(firstLevelOf("royalGrandChef") - 1)).toBe(1);
			expect(getCookingSpecialtiesLimit(firstLevelOf("royalGrandChef"))).toBe(2);
			expect(getCookingSpecialtiesLimit(MASTER_CHEF_BADGE_COOKING_LEVEL - 1)).toBe(2);
			expect(getCookingSpecialtiesLimit(MASTER_CHEF_BADGE_COOKING_LEVEL)).toBe(3);
		});

		it("should announce the level of the next specialty until they are all unlocked", () => {
			expect(getNextCookingSpecialtyUnlockLevel(0)).toBe(firstLevelOf("kitchenMaster"));
			expect(getNextCookingSpecialtyUnlockLevel(firstLevelOf("kitchenMaster"))).toBe(firstLevelOf("royalGrandChef"));
			expect(getNextCookingSpecialtyUnlockLevel(firstLevelOf("royalGrandChef"))).toBe(MASTER_CHEF_BADGE_COOKING_LEVEL);
			expect(getNextCookingSpecialtyUnlockLevel(MASTER_CHEF_BADGE_COOKING_LEVEL)).toBeNull();
		});
	});

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

	describe("getMinCookingLevelForRecipeLevel", () => {
		it.each([
			[2, 0],
			[3, 11],
			[5, 31],
			[6, 51],
			[7, 61],
			[8, 81]
		])("should unlock recipe level %i at the first grade preparing it without penalty (cooking level %i)", (recipeLevel, cookingLevel) => {
			expect(getMinCookingLevelForRecipeLevel(recipeLevel)).toBe(cookingLevel);
		});

		it("should return null when no grade prepares the recipe level without penalty", () => {
			const maxRecipeLevel = Math.max(...COOKING_GRADES.map(grade => grade.maxRecipeLevelWithoutPenalty));
			expect(getMinCookingLevelForRecipeLevel(maxRecipeLevel + 1)).toBeNull();
		});
	});
});
