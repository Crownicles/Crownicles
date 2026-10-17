import { describe, expect, it } from "vitest";
import { SmallEventConstants } from "../../src/constants/SmallEventConstants";
import { MapLocationConstants } from "../../src/constants/MapLocationConstants";
import { ExpeditionConstants } from "../../src/constants/ExpeditionConstants";

describe("SmallEventConstants", () => {
	describe("PET_FOOD", () => {
		it("should only list declared map types as settlements", () => {
			const declaredTypes: readonly string[] = Object.values(MapLocationConstants.TYPES);

			expect(SmallEventConstants.PET_FOOD.GOOD_SMELL_TYPES.filter(type => !declaredTypes.includes(type))).toEqual([]);
		});

		it("should map every biome to an existing probability profile", () => {
			const profiles = Object.keys(SmallEventConstants.PET_FOOD.PROBABILITIES);
			const biomes = Object.values(ExpeditionConstants.EXPEDITION_LOCATION_TYPES);

			expect(biomes.filter(biome => !profiles.includes(SmallEventConstants.PET_FOOD.BIOME_PROBABILITY_PROFILES[biome]))).toEqual([]);
		});

		it("should have valid probability configurations", () => {
			const configs = [
				SmallEventConstants.PET_FOOD.PROBABILITIES.BAD_SMELL,
				SmallEventConstants.PET_FOOD.PROBABILITIES.VEGETARIAN,
				SmallEventConstants.PET_FOOD.PROBABILITIES.MEAT,
				SmallEventConstants.PET_FOOD.PROBABILITIES.GOOD_SMELL,
				SmallEventConstants.PET_FOOD.PROBABILITIES.DEFAULT
			];
			
			for (const config of configs) {
				// Each config should sum to 1.0 (with small floating point tolerance)
				const sum = config.badSmell + config.vegetarian + config.meat + config.goodSmell;
				expect(Math.abs(sum - 1.0)).toBeLessThan(0.0001);
				
				// All probabilities should be between 0 and 1
				expect(config.badSmell).toBeGreaterThanOrEqual(0);
				expect(config.badSmell).toBeLessThanOrEqual(1);
				expect(config.vegetarian).toBeGreaterThanOrEqual(0);
				expect(config.vegetarian).toBeLessThanOrEqual(1);
				expect(config.meat).toBeGreaterThanOrEqual(0);
				expect(config.meat).toBeLessThanOrEqual(1);
				expect(config.goodSmell).toBeGreaterThanOrEqual(0);
				expect(config.goodSmell).toBeLessThanOrEqual(1);
			}
		});
		
		it("should have all FOOD_TYPES represented in PROBABILITIES keys", () => {
			const foodTypes = Object.values(SmallEventConstants.PET_FOOD.FOOD_TYPES);
			const probabilityKeys = [
				...Object.keys(SmallEventConstants.PET_FOOD.PROBABILITIES.BAD_SMELL),
				...Object.keys(SmallEventConstants.PET_FOOD.PROBABILITIES.VEGETARIAN),
				...Object.keys(SmallEventConstants.PET_FOOD.PROBABILITIES.MEAT),
				...Object.keys(SmallEventConstants.PET_FOOD.PROBABILITIES.GOOD_SMELL),
				...Object.keys(SmallEventConstants.PET_FOOD.PROBABILITIES.DEFAULT)
			];
			
			// Note: soup is special (Road of Wonders only) so it won't be in probabilities
			const regularFoodTypes = foodTypes.filter(type => type !== "soup");
			
			for (const foodType of regularFoodTypes) {
				expect(probabilityKeys).toContain(foodType);
			}
		});
	});
});
