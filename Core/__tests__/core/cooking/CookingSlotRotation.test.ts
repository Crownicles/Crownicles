import {
	describe, expect, it
} from "vitest";
import {
	getSlotCycle, getRecipeForSlotExcluding, getUniqueRecipesForSlots, isRecipeSecret
} from "../../../src/core/cooking/CookingSlotRotation";
import {
	SLOT_CONFIGS, RecipeType, MIN_GUARANTEED_PLAYER_LEVEL_RECIPES, CookingOutputType
} from "../../../../Lib/src/constants/CookingConstants";
import { CookingRecipeDataController } from "../../../src/data/CookingRecipeData";

const ALL_RECIPE_IDS = CookingRecipeDataController.instance.getAll().map(recipe => recipe.id);

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

	describe("getRecipeForSlotExcluding", () => {
		it("should return null when no discovered recipes match", () => {
			// Empty discovered list means only discoveredByDefault recipes
			// Slot 3 (potions only, level 3-8) — may have no match for empty list
			const result = getRecipeForSlotExcluding({
				slotIndex: 3, furnacePosition: 0, daySeed: 12345, discoveredRecipeIds: [], excludedRecipeIds: new Set()
			});
			// Result depends on data, but should not crash
			expect(result === null || typeof result.id === "string").toBe(true);
		});

		it("should be deterministic for same parameters", () => {
			const discovered = ["potion_health_1", "potion_health_2", "potion_energy_1"];
			const a = getRecipeForSlotExcluding({
				slotIndex: 0, furnacePosition: 5, daySeed: 42, discoveredRecipeIds: discovered, excludedRecipeIds: new Set()
			});
			const b = getRecipeForSlotExcluding({
				slotIndex: 0, furnacePosition: 5, daySeed: 42, discoveredRecipeIds: discovered, excludedRecipeIds: new Set()
			});
			expect(a?.id).toEqual(b?.id);
		});

		it("should move to the next recipe type of the day cycle at each furnace re-roll", () => {
			const seed = 100;
			const cycle = getSlotCycle(1, seed);
			for (let pos = 0; pos < cycle.length * 2; pos++) {
				const recipe = getRecipeForSlotExcluding({
					slotIndex: 1, furnacePosition: pos, daySeed: seed, discoveredRecipeIds: ALL_RECIPE_IDS, excludedRecipeIds: new Set()
				});
				expect(recipe?.recipeType).toBe(cycle[pos % cycle.length]);
			}
		});

		it("should fall back on the following type of the cycle when the current one has no known recipe", () => {
			const seed = 7;
			const cycle = getSlotCycle(1, seed);
			const [skippedType, nextType] = [cycle[0], cycle[1]];
			const discovered = ALL_RECIPE_IDS.filter(id => CookingRecipeDataController.instance.getById(id)?.recipeType !== skippedType);
			const defaultRecipesOfSkippedType = CookingRecipeDataController.instance.getAll()
				.filter(recipe => recipe.discoveredByDefault && recipe.recipeType === skippedType)
				.map(recipe => recipe.id);

			const recipe = getRecipeForSlotExcluding({
				slotIndex: 1, furnacePosition: 0, daySeed: seed, discoveredRecipeIds: discovered, excludedRecipeIds: new Set(defaultRecipesOfSkippedType)
			});

			expect(recipe?.recipeType).toBe(nextType);
		});

		it("should spread the offers among the recipes of a type over the days", () => {
			const offered = new Set<string>();
			for (let daySeed = 0; daySeed < 60; daySeed++) {
				const recipe = getRecipeForSlotExcluding({
					slotIndex: 1, furnacePosition: 0, daySeed, discoveredRecipeIds: ALL_RECIPE_IDS, excludedRecipeIds: new Set()
				});
				if (recipe) {
					offered.add(recipe.id);
				}
			}
			const typesOffered = new Set([...offered].map(id => CookingRecipeDataController.instance.getById(id)?.recipeType));

			expect(offered.size).toBeGreaterThan(typesOffered.size);
		});

		it("should offer pet food by default, and never when it is not allowed", () => {
			const petFoodOffers = (allowPetFoodRecipes?: boolean): number => {
				let count = 0;
				for (let pos = 0; pos < 40; pos++) {
					const recipe = getRecipeForSlotExcluding({
						slotIndex: 1, furnacePosition: pos, daySeed: 3, discoveredRecipeIds: ALL_RECIPE_IDS, excludedRecipeIds: new Set(),
						...allowPetFoodRecipes === undefined ? {} : { allowPetFoodRecipes }
					});
					if (recipe?.outputType === CookingOutputType.PET_FOOD) {
						count++;
					}
				}
				return count;
			};

			expect(petFoodOffers()).toBeGreaterThan(0);
			expect(petFoodOffers(true)).toBeGreaterThan(0);
			expect(petFoodOffers(false)).toBe(0);
			expect(getRecipeForSlotExcluding({
				slotIndex: 1, furnacePosition: 0, daySeed: 3, discoveredRecipeIds: ALL_RECIPE_IDS, excludedRecipeIds: new Set(), allowPetFoodRecipes: false
			})).not.toBeNull();
		});

		it("should let every furnace offer pet food unless told otherwise", () => {
			const offersPetFood = Array.from({ length: 20 }, (_v, daySeed) => getUniqueRecipesForSlots({
				cookingSlots: SLOT_CONFIGS.length, furnacePosition: daySeed, daySeed, discoveredRecipeIds: ALL_RECIPE_IDS
			})).some(recipes => recipes.some(recipe => recipe?.outputType === CookingOutputType.PET_FOOD));

			expect(offersPetFood).toBe(true);
		});
	});

	describe("getUniqueRecipesForSlots", () => {
		it("should not propose the same recipe in two slots at the same time", () => {
			const discovered = CookingRecipeDataController.instance.getAll().map(recipe => recipe.id);
			const daySeeds = [
				1,
				42,
				12345
			];

			for (const daySeed of daySeeds) {
				for (let furnacePosition = 0; furnacePosition < 40; furnacePosition++) {
					const recipes = getUniqueRecipesForSlots({
						cookingSlots: SLOT_CONFIGS.length,
						furnacePosition,
						daySeed,
						discoveredRecipeIds: discovered
					});
					const ids = recipes.filter(recipe => recipe !== null).map(recipe => recipe!.id);
					expect(ids).toHaveLength(new Set(ids).size);
				}
			}
		});

		it("should exclude pet food recipes when guild storage is unavailable", () => {
			const discovered = CookingRecipeDataController.instance.getAll().map(recipe => recipe.id);
			const recipes = getUniqueRecipesForSlots({
				cookingSlots: SLOT_CONFIGS.length,
				furnacePosition: 12,
				daySeed: 77,
				discoveredRecipeIds: discovered,
				allowPetFoodRecipes: false
			});

			expect(recipes.every(recipe => recipe === null || recipe.outputType !== CookingOutputType.PET_FOOD)).toBe(true);
		});

		it("should never offer the excluded recipes (the specialties) and keep every station filled", () => {
			const discovered = CookingRecipeDataController.instance.getAll().map(recipe => recipe.id);
			for (let furnacePosition = 0; furnacePosition < 40; furnacePosition++) {
				const options = {
					cookingSlots: SLOT_CONFIGS.length,
					furnacePosition,
					daySeed: 77,
					discoveredRecipeIds: discovered
				};
				// Exclude what the rotation would naturally offer on the first three stations
				const excludedRecipeIds = new Set(getUniqueRecipesForSlots(options).slice(0, 3).map(recipe => recipe!.id));

				const recipes = getUniqueRecipesForSlots({
					...options,
					excludedRecipeIds
				});

				expect(recipes.some(recipe => recipe && excludedRecipeIds.has(recipe.id))).toBe(false);
				expect(recipes.every(recipe => recipe !== null)).toBe(true);
			}
		});

		it("should guarantee at least 2 recipes at player level for low-level players", () => {
			const discovered = CookingRecipeDataController.instance.getAll().map(recipe => recipe.id);
			const maxRecipeLevelWithoutPenalty = 2; // Aide-cuisine grade

			for (let furnacePosition = 0; furnacePosition < 40; furnacePosition++) {
				const recipes = getUniqueRecipesForSlots({
					cookingSlots: SLOT_CONFIGS.length,
					furnacePosition,
					daySeed: 42,
					discoveredRecipeIds: discovered,
					maxRecipeLevelWithoutPenalty
				});

				const playerLevelRecipes = recipes.filter(
					recipe => recipe !== null && recipe.level <= maxRecipeLevelWithoutPenalty
				);
				expect(playerLevelRecipes.length).toBeGreaterThanOrEqual(MIN_GUARANTEED_PLAYER_LEVEL_RECIPES);
			}
		});

		it("should guarantee player-level recipes across many day seeds", () => {
			const discovered = CookingRecipeDataController.instance.getAll().map(recipe => recipe.id);
			const maxRecipeLevelWithoutPenalty = 2;

			for (const daySeed of [1, 42, 100, 999, 12345, 50000]) {
				for (let furnacePosition = 0; furnacePosition < 20; furnacePosition++) {
					const recipes = getUniqueRecipesForSlots({
						cookingSlots: SLOT_CONFIGS.length,
						furnacePosition,
						daySeed,
						discoveredRecipeIds: discovered,
						maxRecipeLevelWithoutPenalty
					});

					const playerLevelRecipes = recipes.filter(
						recipe => recipe !== null && recipe.level <= maxRecipeLevelWithoutPenalty
					);
					expect(playerLevelRecipes.length).toBeGreaterThanOrEqual(MIN_GUARANTEED_PLAYER_LEVEL_RECIPES);
				}
			}
		});

		it("should still produce no duplicates when using level guarantee", () => {
			const discovered = CookingRecipeDataController.instance.getAll().map(recipe => recipe.id);

			for (const daySeed of [1, 42, 12345]) {
				for (let furnacePosition = 0; furnacePosition < 40; furnacePosition++) {
					const recipes = getUniqueRecipesForSlots({
						cookingSlots: SLOT_CONFIGS.length,
						furnacePosition,
						daySeed,
						discoveredRecipeIds: discovered,
						maxRecipeLevelWithoutPenalty: 2
					});
					const ids = recipes.filter(recipe => recipe !== null).map(recipe => recipe!.id);
					expect(ids).toHaveLength(new Set(ids).size);
				}
			}
		});

		it("should behave identically without maxRecipeLevelWithoutPenalty parameter", () => {
			const discovered = CookingRecipeDataController.instance.getAll().map(recipe => recipe.id);
			const recipesWithout = getUniqueRecipesForSlots({
				cookingSlots: SLOT_CONFIGS.length,
				furnacePosition: 5,
				daySeed: 42,
				discoveredRecipeIds: discovered
			});
			// Without the param, should still work (backward compatible)
			expect(recipesWithout).toHaveLength(SLOT_CONFIGS.length);
		});

		it.each([
			1, 42, 100, 999, 12345, 50000
		])("should always fill the dedicated material slot with a material recipe, even with default recipes only (day %i)", daySeed => {
			const materialSlotIndex = SLOT_CONFIGS.findIndex(
				config => config.eligibleTypes.length === 1 && config.eligibleTypes[0] === RecipeType.MATERIAL_CRAFT
			);
			expect(materialSlotIndex).toBeGreaterThanOrEqual(0);

			for (let furnacePosition = 0; furnacePosition < 20; furnacePosition++) {
				const recipes = getUniqueRecipesForSlots({
					cookingSlots: SLOT_CONFIGS.length,
					furnacePosition,
					daySeed,
					discoveredRecipeIds: [],
					maxRecipeLevelWithoutPenalty: 2
				});

				expect(recipes[materialSlotIndex]?.recipeType, `furnace position ${furnacePosition}`).toBe(RecipeType.MATERIAL_CRAFT);
			}
		});
	});

	describe("isRecipeSecret", () => {
		it("should be deterministic for same inputs", () => {
			const a = isRecipeSecret({
				slotIndex: 0, furnacePosition: 3, daySeed: 42, secretRate: 0.5
			});
			const b = isRecipeSecret({
				slotIndex: 0, furnacePosition: 3, daySeed: 42, secretRate: 0.5
			});
			expect(a).toBe(b);
		});

		it("should return false when secretRate is 0", () => {
			// With rate 0, no recipe should ever be secret
			let anySecret = false;
			for (let i = 0; i < 100; i++) {
				if (isRecipeSecret({
					slotIndex: 0, furnacePosition: i, daySeed: i * 7, secretRate: 0
				})) {
					anySecret = true;
				}
			}
			expect(anySecret).toBe(false);
		});

		it("should return true when secretRate is 1", () => {
			// With rate 1.0, all should be secret
			let allSecret = true;
			for (let i = 0; i < 100; i++) {
				if (!isRecipeSecret({
					slotIndex: 0, furnacePosition: i, daySeed: i * 7, secretRate: 1
				})) {
					allSecret = false;
				}
			}
			expect(allSecret).toBe(true);
		});
	});



	describe("getUniqueRecipesForSlots station count", () => {
		it.each([1, 2, SLOT_CONFIGS.length - 1])("should fill exactly %i stations, with or without the level guarantee", cookingSlots => {
			for (let daySeed = 0; daySeed < 20; daySeed++) {
				expect(getUniqueRecipesForSlots({
					cookingSlots, furnacePosition: daySeed, daySeed, discoveredRecipeIds: ALL_RECIPE_IDS
				})).toHaveLength(cookingSlots);
				expect(getUniqueRecipesForSlots({
					cookingSlots, furnacePosition: daySeed, daySeed, discoveredRecipeIds: ALL_RECIPE_IDS, maxRecipeLevelWithoutPenalty: 2
				})).toHaveLength(cookingSlots);
			}
		});

		it("should never offer more stations than the furnace has", () => {
			expect(getUniqueRecipesForSlots({
				cookingSlots: SLOT_CONFIGS.length + 3, furnacePosition: 0, daySeed: 1, discoveredRecipeIds: ALL_RECIPE_IDS
			})).toHaveLength(SLOT_CONFIGS.length);
		});

		it("should leave a station empty rather than fail when no recipe fits it, even with the level guarantee", () => {
			const recipes = getUniqueRecipesForSlots({
				cookingSlots: SLOT_CONFIGS.length,
				furnacePosition: 0,
				daySeed: 1,
				discoveredRecipeIds: [],
				maxRecipeLevelWithoutPenalty: 2,
				excludedRecipeIds: new Set(ALL_RECIPE_IDS)
			});

			expect(recipes).toEqual(new Array(SLOT_CONFIGS.length).fill(null));
		});

		it("should only force the guaranteed number of stations to the player level, the others offering harder recipes", () => {
			const maxRecipeLevelWithoutPenalty = 3;
			let harderOffers = 0;
			for (let daySeed = 0; daySeed < 50; daySeed++) {
				const recipes = getUniqueRecipesForSlots({
					cookingSlots: SLOT_CONFIGS.length, furnacePosition: daySeed, daySeed, discoveredRecipeIds: ALL_RECIPE_IDS, maxRecipeLevelWithoutPenalty
				});
				const easyRecipes = recipes.filter(recipe => recipe !== null && recipe.level <= maxRecipeLevelWithoutPenalty);
				expect(easyRecipes.length).toBeGreaterThanOrEqual(MIN_GUARANTEED_PLAYER_LEVEL_RECIPES);
				// The guarantee is met on the first two stations: the next ones offer recipes of their whole level range
				harderOffers += recipes.slice(MIN_GUARANTEED_PLAYER_LEVEL_RECIPES, 4).filter(recipe => recipe !== null && recipe.level > maxRecipeLevelWithoutPenalty).length;
			}

			expect(harderOffers).toBeGreaterThan(0);
		});
	});

	describe("isRecipeSecret distribution", () => {
		it("should hide about the secret rate of the recipes, varying with the day, the furnace and the station", () => {
			const secretRate = 0.3;
			let secrets = 0;
			let total = 0;
			const bySlot = new Map<number, number>();
			for (let daySeed = 0; daySeed < 20; daySeed++) {
				for (let furnacePosition = 0; furnacePosition < 10; furnacePosition++) {
					for (let slotIndex = 0; slotIndex < SLOT_CONFIGS.length; slotIndex++) {
						total++;
						if (isRecipeSecret({
							slotIndex, furnacePosition, daySeed, secretRate
						})) {
							secrets++;
							bySlot.set(slotIndex, (bySlot.get(slotIndex) ?? 0) + 1);
						}
					}
				}
			}

			expect(secrets / total).toBeGreaterThan(secretRate - 0.08);
			expect(secrets / total).toBeLessThan(secretRate + 0.08);
			expect(bySlot.size).toBe(SLOT_CONFIGS.length);
		});

		it("should hide a different set of stations from one re-roll to the next", () => {
			const pattern = (furnacePosition: number): boolean[] => SLOT_CONFIGS.map((_config, slotIndex) => isRecipeSecret({
				slotIndex, furnacePosition, daySeed: 5, secretRate: 0.5
			}));
			const patterns = new Set(Array.from({ length: 10 }, (_v, pos) => pattern(pos).join()));

			expect(patterns.size).toBeGreaterThan(1);
		});
	});

	describe("edge cases", () => {
		it("should return an empty array when cookingSlots is 0", () => {
			const discovered = CookingRecipeDataController.instance.getAll().map(recipe => recipe.id);
			const recipes = getUniqueRecipesForSlots({
				cookingSlots: 0,
				furnacePosition: 5,
				daySeed: 42,
				discoveredRecipeIds: discovered
			});
			expect(recipes).toHaveLength(0);
		});

		it("should handle empty discoveredRecipeIds with no default recipes gracefully", () => {
			const recipes = getUniqueRecipesForSlots({
				cookingSlots: SLOT_CONFIGS.length,
				furnacePosition: 0,
				daySeed: 42,
				discoveredRecipeIds: []
			});
			// Should not crash — recipes are either null or discoveredByDefault
			for (const recipe of recipes) {
				if (recipe !== null) {
					expect(recipe.discoveredByDefault).toBe(true);
				}
			}
		});
	});
});
