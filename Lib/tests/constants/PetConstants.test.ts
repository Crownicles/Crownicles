import { describe, expect, it } from "vitest";
import { PetConstants } from "../../src/constants/PetConstants";

describe("PetConstants", () => {
	describe("NICKNAME_LENGTH_RANGE", () => {
		it("should have MIN less than or equal to MAX", () => {
			expect(PetConstants.NICKNAME_LENGTH_RANGE.MIN).toBeLessThanOrEqual(PetConstants.NICKNAME_LENGTH_RANGE.MAX);
		});
	});

	describe("SELL_PRICE", () => {
		it("should have MIN less than or equal to MAX", () => {
			expect(PetConstants.SELL_PRICE.MIN).toBeLessThanOrEqual(PetConstants.SELL_PRICE.MAX);
		});
	});

	describe("LOVE_LEVELS", () => {
		it("should be sorted in ascending order", () => {
			for (let i = 0; i < PetConstants.LOVE_LEVELS.length - 1; i++) {
				expect(PetConstants.LOVE_LEVELS[i]).toBeLessThanOrEqual(PetConstants.LOVE_LEVELS[i + 1]);
			}
		});
	});

	describe("PET_FOOD_BY_ID and PET_FOOD_LOVE_POINTS_AMOUNT", () => {
		it("should have the same number of elements", () => {
			expect(PetConstants.PET_FOOD_BY_ID.length).toBe(PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT.length);
		});
	});

	describe("PET_BEHAVIORS", () => {
		it("should have a behavior for every pet type", () => {
			const allPetIdsWithBehaviors = PetConstants.PET_BEHAVIORS.flatMap(behavior => behavior.petIds);
			const allPetTypes = Object.values(PetConstants.PETS).filter(petId => petId !== PetConstants.PETS.NO_PET);

			for (const petId of allPetTypes) {
				expect(allPetIdsWithBehaviors).toContain(petId);
			}
		});

		it("should not have duplicate petIds", () => {
			const petIds = PetConstants.PET_BEHAVIORS.flatMap(behavior => behavior.petIds);
			const uniquePetIds = new Set(petIds);
			expect(petIds.length).toBe(uniquePetIds.size);
		});

		it("should not have duplicate behaviorIds", () => {
			const behaviorIds = PetConstants.PET_BEHAVIORS.map(behavior => behavior.behaviorId);
			const uniqueBehaviorIds = new Set(behaviorIds);
			expect(behaviorIds.length).toBe(uniqueBehaviorIds.size);
		});
	});
});
