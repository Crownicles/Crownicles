import { describe, expect, it } from "vitest";
import { SmallEventConstants } from "../../src/constants/SmallEventConstants";
import * as fs from "fs";
import * as path from "path";

describe("SmallEventConstants", () => {
	describe("PET_FOOD", () => {
		const MAP_LOCATIONS_DIR = path.join(__dirname, "../../../Core/resources/mapLocations");
		
		// Helper to get all location types that are on the main continent
		function getMainContinentLocationTypes(): Map<number, string> {
			const locationTypes = new Map<number, string>();
			
			if (!fs.existsSync(MAP_LOCATIONS_DIR)) {
				console.warn(`Map locations directory not found: ${MAP_LOCATIONS_DIR}`);
				return locationTypes;
			}
			
			const files = fs.readdirSync(MAP_LOCATIONS_DIR);
			
			for (const file of files) {
				if (!file.endsWith(".json")) {
					continue;
				}
				
				const locationId = parseInt(file.replace(".json", ""));
				
				const filePath = path.join(MAP_LOCATIONS_DIR, file);
				const content = fs.readFileSync(filePath, "utf-8");
				const location = JSON.parse(content);
				
				// Check if location has continent1 attribute (main continent marker)
				// We don't check main_continent as it's a special marker for the continent itself, not a playable location
				if (location.attribute === "continent1") {
					locationTypes.set(locationId, location.type);
				}
			}
			
			return locationTypes;
		}
		
		// Helper to get all food types defined in constants
		function getAllPetFoodTypes(): Set<string> {
			const allTypes = new Set<string>();
			
			SmallEventConstants.PET_FOOD.BAD_SMELL_TYPES.forEach(type => allTypes.add(type));
			SmallEventConstants.PET_FOOD.VEGETARIAN_TYPES.forEach(type => allTypes.add(type));
			SmallEventConstants.PET_FOOD.MEAT_TYPES.forEach(type => allTypes.add(type));
			SmallEventConstants.PET_FOOD.GOOD_SMELL_TYPES.forEach(type => allTypes.add(type));
			
			return allTypes;
		}
		
		it("should include all main continent location types in PET_FOOD constants", () => {
			const mainContinentTypes = getMainContinentLocationTypes();
			const petFoodTypes = getAllPetFoodTypes();
			
			// Special types that should be excluded from the check (castle types, special zones)
			const excludedTypes = new Set([
				"castleEntrance",
				"castleThrone",
				"continent",
				"pveExit",
				"testZone",
				"hauntedHouse",
				"mistyPath"
			]);
			
			const missingTypes: string[] = [];
			
			for (const [locationId, locationType] of mainContinentTypes.entries()) {
				// Skip special excluded types
				if (excludedTypes.has(locationType)) {
					continue;
				}
				
				// Check if this location type is covered by any PET_FOOD category
				if (!petFoodTypes.has(locationType)) {
					missingTypes.push(`Location ID ${locationId} has type "${locationType}" which is not in any PET_FOOD category`);
				}
			}
			
			expect(missingTypes).toEqual([]);
		});
		
		it("should only contain types that exist in at least one main continent location", () => {
			const mainContinentTypes = getMainContinentLocationTypes();
			const locationTypesSet = new Set(Array.from(mainContinentTypes.values()));
			
			// Special types that are allowed even if not in location files (castle types are valid)
			const allowedSpecialTypes = new Set([
				"castleEntrance",
				"castleThrone"
			]);
			
			const allPetFoodTypes = getAllPetFoodTypes();
			const unusedTypes: string[] = [];
			
			for (const type of allPetFoodTypes) {
				if (!locationTypesSet.has(type) && !allowedSpecialTypes.has(type)) {
					unusedTypes.push(type);
				}
			}
			
			expect(unusedTypes).toEqual([]);
		});
		
		it("should not have duplicate types across different categories", () => {
			const typeOccurrences = new Map<string, string[]>();
			
			const categories = {
				BAD_SMELL_TYPES: SmallEventConstants.PET_FOOD.BAD_SMELL_TYPES,
				VEGETARIAN_TYPES: SmallEventConstants.PET_FOOD.VEGETARIAN_TYPES,
				MEAT_TYPES: SmallEventConstants.PET_FOOD.MEAT_TYPES,
				GOOD_SMELL_TYPES: SmallEventConstants.PET_FOOD.GOOD_SMELL_TYPES
			};
			
			for (const [categoryName, types] of Object.entries(categories)) {
				for (const type of types) {
					if (!typeOccurrences.has(type)) {
						typeOccurrences.set(type, []);
					}
					typeOccurrences.get(type)!.push(categoryName);
				}
			}
			
			const duplicates: string[] = [];
			for (const [type, categories] of typeOccurrences.entries()) {
				if (categories.length > 1) {
					duplicates.push(`Type "${type}" appears in multiple categories: ${categories.join(", ")}`);
				}
			}
			
			expect(duplicates).toEqual([]);
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
