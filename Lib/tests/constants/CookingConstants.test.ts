import {
	describe, expect, it
} from "vitest";
import {
	CookingSpecialtyConstants, hasUnlockedCookingSpecialties, isRecipeEligibleForSlot, RecipeType, SLOT_CONFIGS,
	SPECIALTY_SLOT_INDEX
} from "../../src/constants/CookingConstants";

describe("hasUnlockedCookingSpecialties", () => {
	it("unlocks the specialties from the first unlock level on", () => {
		const firstUnlockLevel = CookingSpecialtyConstants.UNLOCK_COOKING_LEVELS[0];

		expect(hasUnlockedCookingSpecialties(firstUnlockLevel - 1)).toBe(false);
		expect(hasUnlockedCookingSpecialties(firstUnlockLevel)).toBe(true);
	});
});

describe("isRecipeEligibleForSlot", () => {
	const firstSlot = SLOT_CONFIGS[0];

	it("offers a recipe of the station type within its level range, bounds included", () => {
		expect(isRecipeEligibleForSlot({
			level: firstSlot.minLevel, recipeType: RecipeType.POTION_HEALTH
		}, 0)).toBe(true);
		expect(isRecipeEligibleForSlot({
			level: firstSlot.maxLevel, recipeType: RecipeType.PETFOOD_MEAT
		}, 0)).toBe(true);
	});

	it("refuses a recipe outside the level range of the station", () => {
		const potionSlotIndex = SLOT_CONFIGS.findIndex(config => config.potionsOnly);
		const potionSlot = SLOT_CONFIGS[potionSlotIndex];

		expect(isRecipeEligibleForSlot({
			level: potionSlot.minLevel - 1, recipeType: RecipeType.POTION_HEALTH
		}, potionSlotIndex)).toBe(false);
		expect(isRecipeEligibleForSlot({
			level: firstSlot.maxLevel + 1, recipeType: RecipeType.POTION_HEALTH
		}, 0)).toBe(false);
	});

	it("refuses a recipe type the station does not cook", () => {
		expect(isRecipeEligibleForSlot({
			level: firstSlot.minLevel, recipeType: RecipeType.PETFOOD_ULTIMATE
		}, 0)).toBe(false);
	});

	it("never offers a rotating recipe on the specialty station", () => {
		expect(isRecipeEligibleForSlot({
			level: 1, recipeType: RecipeType.POTION_HEALTH
		}, SPECIALTY_SLOT_INDEX)).toBe(false);
	});
});
