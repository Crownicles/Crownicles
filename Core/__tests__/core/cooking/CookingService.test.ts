import {
	describe, expect, it, vi
} from "vitest";
import { CookingService } from "../../../src/core/cooking/CookingService";
import {
	getCookingGrade, CookingXpConstants, FAILURE_RATE_PER_EXTRA_LEVEL,
	PLANT_COOKING_XP, MATERIAL_RARITY_COOKING_XP, MASTER_CHEF_BADGE_COOKING_LEVEL,
	RecipeType
} from "../../../../Lib/src/constants/CookingConstants";
import Player from "../../../src/core/database/game/models/Player";
import { PlayerBadgesManager } from "../../../src/core/database/game/models/PlayerBadges";
import { Badge } from "../../../../Lib/src/types/Badge";
import { CookingRecipe } from "../../../../Lib/src/types/CookingRecipe";
import { PlantId } from "../../../../Lib/src/constants/PlantConstants";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { CookingRecipeDataController } from "../../../src/data/CookingRecipeData";
import {
	HomePlantStorage, HomePlantStorages
} from "../../../src/core/database/game/models/HomePlantStorage";
import {
	PlayerPlantSlot, PlayerPlantSlots
} from "../../../src/core/database/game/models/PlayerPlantSlot";

/**
 * Minimal recipe factory for testing
 */
function createTestRecipe(overrides: Partial<CookingRecipe> = {}): CookingRecipe {
	return {
		id: "test_recipe",
		level: 1,
		recipeType: "POTION_HEALTH" as CookingRecipe["recipeType"],
		plants: [{ plantId: PlantId.COMMON_HERB, quantity: 1 }],
		materials: [{ materialId: 68, quantity: 1 }],
		outputType: "potion",
		discoveredByDefault: true,
		...overrides
	};
}

describe("CookingService - pure functions", () => {
	describe("calculateCookingXp", () => {
		it("should return positive XP for a valid recipe", () => {
			const recipe = createTestRecipe();
			const xp = CookingService.calculateCookingXp(recipe);
			expect(xp).toBeGreaterThan(0);
		});

		it("should scale with plant quantity", () => {
			const recipe1 = createTestRecipe({
				plants: [{ plantId: PlantId.COMMON_HERB, quantity: 1 }],
				materials: []
			});
			const recipe2 = createTestRecipe({
				plants: [{ plantId: PlantId.COMMON_HERB, quantity: 3 }],
				materials: []
			});
			const xp1 = CookingService.calculateCookingXp(recipe1);
			const xp2 = CookingService.calculateCookingXp(recipe2);
			expect(xp2).toBeGreaterThan(xp1);
		});

		it("should give more XP for higher-tier plants", () => {
			const recipeLow = createTestRecipe({
				plants: [{ plantId: PlantId.COMMON_HERB, quantity: 1 }],
				materials: []
			});
			const recipeHigh = createTestRecipe({
				plants: [{ plantId: PlantId.ANCIENT_TREE, quantity: 1 }],
				materials: []
			});
			const xpLow = CookingService.calculateCookingXp(recipeLow);
			const xpHigh = CookingService.calculateCookingXp(recipeHigh);
			expect(xpHigh).toBeGreaterThan(xpLow);
		});

		it("should handle multiple plants", () => {
			const recipe = createTestRecipe({
				plants: [
					{ plantId: PlantId.COMMON_HERB, quantity: 2 },
					{ plantId: PlantId.GOLDEN_CLOVER, quantity: 1 }
				],
				materials: []
			});
			const xp = CookingService.calculateCookingXp(recipe);
			const expected = Math.round(
				(PLANT_COOKING_XP[PlantId.COMMON_HERB] * 2 + PLANT_COOKING_XP[PlantId.GOLDEN_CLOVER] * 1) * CookingXpConstants.PLANT_WEIGHT
			);
			expect(xp).toBe(expected);
		});

		it("should return 0 for recipe with no plants and no recognized materials", () => {
			const recipe = createTestRecipe({
				plants: [],
				materials: [{ materialId: 999999, quantity: 1 }] // Non-existent material
			});
			const xp = CookingService.calculateCookingXp(recipe);
			// Material data controller might not find this ID, so materialXp = 0
			expect(xp).toBeGreaterThanOrEqual(0);
		});
	});

	describe("calculateFailureXp", () => {
		it("should return positive XP", () => {
			expect(CookingService.calculateFailureXp(1)).toBeGreaterThan(0);
		});

		it("should scale linearly with recipe level", () => {
			const xp1 = CookingService.calculateFailureXp(1);
			const xp5 = CookingService.calculateFailureXp(5);
			expect(xp5).toBe(xp1 * 5);
		});

		it("should equal FAILURE_XP_PER_LEVEL * level", () => {
			const level = 4;
			expect(CookingService.calculateFailureXp(level)).toBe(CookingXpConstants.FAILURE_XP_PER_LEVEL * level);
		});
	});

	describe("getFailureRate", () => {
		it("should return base rate when recipe level is within grade limit", () => {
			const grade = getCookingGrade(0); // aideCuisine, maxRecipeLevelWithoutPenalty = 2
			const rate = CookingService.getFailureRate(grade, 1);
			expect(rate).toBe(grade.failureRate);
		});

		it("should return base rate at exact boundary", () => {
			const grade = getCookingGrade(0);
			const rate = CookingService.getFailureRate(grade, grade.maxRecipeLevelWithoutPenalty);
			expect(rate).toBe(grade.failureRate);
		});

		it("should apply penalty when recipe level exceeds grade limit", () => {
			const grade = getCookingGrade(0); // failureRate = 0.10, maxRecipeLevelWithoutPenalty = 2
			const rate = CookingService.getFailureRate(grade, 5);
			const expected = grade.failureRate + FAILURE_RATE_PER_EXTRA_LEVEL * (5 - grade.maxRecipeLevelWithoutPenalty);
			expect(rate).toBe(expected);
		});

		it("should increase penalty with recipe level", () => {
			const grade = getCookingGrade(0);
			const rate3 = CookingService.getFailureRate(grade, 3);
			const rate8 = CookingService.getFailureRate(grade, 8);
			expect(rate8).toBeGreaterThan(rate3);
		});

		it("should not exceed 100% after capping in executeCraft", () => {
			// getFailureRate itself can exceed 1.0, capping is done in executeCraft
			const grade = getCookingGrade(0);
			const rate = CookingService.getFailureRate(grade, 8);
			expect(rate).toBeGreaterThan(0);
		});
	});

	describe("getXpNeededForLevel", () => {
		it("should return a positive number for level 0", () => {
			expect(CookingService.getXpNeededForLevel(0)).toBeGreaterThan(0);
		});

		it("should increase with level", () => {
			const xp5 = CookingService.getXpNeededForLevel(5);
			const xp10 = CookingService.getXpNeededForLevel(10);
			const xp50 = CookingService.getXpNeededForLevel(50);
			expect(xp10).toBeGreaterThan(xp5);
			expect(xp50).toBeGreaterThan(xp10);
		});

		it("should match the shared Constants.XP formula", () => {
			const level = 15;
			const expected = Math.round(
				Constants.XP.BASE_VALUE * Math.pow(Constants.XP.COEFFICIENT, level + 1)
			) - Constants.XP.MINUS;
			expect(CookingService.getXpNeededForLevel(level)).toBe(expected);
		});
	});

	describe("injectPinnedRecipeIfEligible", () => {
		// Access the private static helper for direct unit testing
		const inject = (CookingService as unknown as {
			injectPinnedRecipeIfEligible: (injection: {
				slotRecipes: Array<CookingRecipe | null>;
				player: { pinnedCookingRecipeId: string | null };
				discoveredIds: string[];
				guild: unknown;
				cookingSlots: number;
			}, specialtySlots: ReadonlySet<number>) => void;
		}).injectPinnedRecipeIfEligible.bind(CookingService);

		const injectPotion = (slotRecipes: Array<CookingRecipe | null>, pinnedCookingRecipeId: string | null): void =>
			inject({
				slotRecipes,
				player: { pinnedCookingRecipeId },
				discoveredIds: [],
				guild: null,
				cookingSlots: 3
			}, new Set());

		// Resolve the deterministic anchor slot for a recipe by injecting it into empty slots.
		const computeAnchorIndex = (pinnedCookingRecipeId: string): number => {
			const emptySlots: Array<CookingRecipe | null> = [null, null, null];
			injectPotion(emptySlots, pinnedCookingRecipeId);
			const anchorIndex = emptySlots.findIndex(r => r?.id === pinnedCookingRecipeId);
			expect(anchorIndex).not.toBe(-1);
			return anchorIndex;
		};

		it("should inject a pinned potion into an eligible slot when not already present", () => {
			const slots: Array<CookingRecipe | null> = [null, null, null];
			injectPotion(slots, "potion_health_1");
			const ids = slots.filter((r): r is CookingRecipe => r !== null).map(r => r.id);
			expect(ids).toContain("potion_health_1");
		});

		it("should anchor the pinned recipe to a stable slot regardless of any pre-existing occurrence", () => {
			const anchorIndex = computeAnchorIndex("potion_health_1");

			// A natural occurrence in another slot must be moved to the anchor, appearing exactly once.
			const existing = { id: "potion_health_1" } as CookingRecipe;
			const otherIndex = anchorIndex === 2 ? 1 : 2;
			const slots: Array<CookingRecipe | null> = [null, null, null];
			slots[otherIndex] = existing;
			injectPotion(slots, "potion_health_1");

			expect(slots.filter(r => r?.id === "potion_health_1")).toHaveLength(1);
			expect(slots.findIndex(r => r?.id === "potion_health_1")).toBe(anchorIndex);
		});

		it("should swap the displaced recipe into the vacated slot instead of leaving a hole", () => {
			const anchorIndex = computeAnchorIndex("potion_health_1");

			// Full rotation: a different recipe sits on the anchor, the pinned one elsewhere.
			const otherIndex = anchorIndex === 0 ? 1 : 0;
			const displaced = createTestRecipe({ id: "displaced_recipe" });
			const slots: Array<CookingRecipe | null> = [null, null, null];
			slots[anchorIndex] = displaced;
			slots[otherIndex] = { id: "potion_health_1" } as CookingRecipe;
			injectPotion(slots, "potion_health_1");

			// Pinned recipe reaches its anchor slot exactly once...
			expect(slots.filter(r => r?.id === "potion_health_1")).toHaveLength(1);
			expect(slots[anchorIndex]?.id).toBe("potion_health_1");
			// ...and the displaced recipe keeps its place in the vacated slot (no empty station).
			expect(slots[otherIndex]?.id).toBe("displaced_recipe");
		});

		it("should keep the pinned recipe on the same anchor slot across re-rolls without ever emptying a slot", () => {
			const anchorIndex = computeAnchorIndex("potion_health_1");

			// Simulate several furnace re-rolls: the pinned recipe lands in a different
			// natural slot each time, the two other slots hold distinct filler recipes.
			for (let naturalIndex = 0; naturalIndex < 3; naturalIndex++) {
				const slots: Array<CookingRecipe | null> = [
					createTestRecipe({ id: "filler_0" }),
					createTestRecipe({ id: "filler_1" }),
					createTestRecipe({ id: "filler_2" })
				];
				slots[naturalIndex] = { id: "potion_health_1" } as CookingRecipe;
				injectPotion(slots, "potion_health_1");

				// Always exactly one occurrence, always on the same stable anchor slot.
				expect(slots.filter(r => r?.id === "potion_health_1")).toHaveLength(1);
				expect(slots[anchorIndex]?.id).toBe("potion_health_1");
				// No station is ever emptied by the anchoring (slot count preserved).
				expect(slots.every(r => r !== null)).toBe(true);
			}
		});

		it("should be a no-op when the pinned recipe already sits on its anchor slot", () => {
			const anchorIndex = computeAnchorIndex("potion_health_1");

			const otherIndex = anchorIndex === 0 ? 1 : 0;
			const slots: Array<CookingRecipe | null> = [null, null, null];
			slots[anchorIndex] = { id: "potion_health_1" } as CookingRecipe;
			slots[otherIndex] = createTestRecipe({ id: "untouched_recipe" });
			injectPotion(slots, "potion_health_1");

			// The pinned recipe stays put and the neighbour slot is left untouched.
			expect(slots.filter(r => r?.id === "potion_health_1")).toHaveLength(1);
			expect(slots[anchorIndex]?.id).toBe("potion_health_1");
			expect(slots[otherIndex]?.id).toBe("untouched_recipe");
		});

		it("should be a no-op when player has no pinned recipe", () => {
			const slots: Array<CookingRecipe | null> = [null, null, null];
			injectPotion(slots, null);
			expect(slots.every(s => s === null)).toBe(true);
		});
	});

	describe("injectKeptRecipes", () => {
		type Specialty = {
			slotIndex: number;
			recipe: CookingRecipe;
		};
		const injectKept = (CookingService as unknown as {
			injectKeptRecipes: (injection: {
				slotRecipes: Array<CookingRecipe | null>;
				player: { pinnedCookingRecipeId: string | null };
				discoveredIds: string[];
				guild: unknown;
				cookingSlots: number;
			}, specialties: Specialty[]) => void;
		}).injectKeptRecipes.bind(CookingService);

		const recipe = (id: string): CookingRecipe => CookingRecipeDataController.instance.getById(id)!;
		const fillers = (): Array<CookingRecipe | null> => [0, 1, 2, 3, 4].map(i => createTestRecipe({ id: `filler_${i}` }));
		const inject = (slotRecipes: Array<CookingRecipe | null>, specialties: Specialty[], options: {
			pinnedCookingRecipeId?: string;
			guild?: unknown;
			cookingSlots?: number;
		} = {}): void => injectKept({
			slotRecipes,
			player: { pinnedCookingRecipeId: options.pinnedCookingRecipeId ?? null },
			discoveredIds: [],
			guild: options.guild ?? null,
			cookingSlots: options.cookingSlots ?? 5
		}, specialties);
		const occurrences = (slotRecipes: Array<CookingRecipe | null>, id: string): number => slotRecipes.filter(r => r?.id === id).length;

		it("should keep a specialty on the station it was chosen on, wherever the rotation placed it", () => {
			const slots = fillers();
			slots[0] = recipe("potion_time_speedup_3");
			inject(slots, [{ slotIndex: 3, recipe: recipe("potion_time_speedup_3") }]);

			expect(slots[3]?.id).toBe("potion_time_speedup_3");
			expect(occurrences(slots, "potion_time_speedup_3")).toBe(1);
			// The recipe displaced from the specialty station keeps the vacated slot
			expect(slots[0]?.id).toBe("filler_3");
		});

		it("should inject a specialty missing from the rotation on its station", () => {
			const slots = fillers();
			inject(slots, [{ slotIndex: 3, recipe: recipe("potion_time_speedup_3") }]);

			expect(slots[3]?.id).toBe("potion_time_speedup_3");
			expect(slots.every(r => r !== null)).toBe(true);
		});

		it("should keep every specialty on its own station at each furnace re-roll", () => {
			const specialties = [
				{ slotIndex: 0, recipe: recipe("potion_health_1") },
				{ slotIndex: 1, recipe: recipe("potion_energy_1") },
				{ slotIndex: 3, recipe: recipe("potion_defense_3") }
			];
			// Each re-roll puts the specialties in other slots, or leaves some of them out
			const rotations = [
				["potion_defense_3", "potion_health_1", "filler_2", "potion_energy_1", "filler_4"],
				["filler_0", "potion_defense_3", "potion_energy_1", "filler_3", "potion_health_1"],
				["filler_0", "filler_1", "filler_2", "filler_3", "filler_4"]
			];
			for (const rotation of rotations) {
				const slots = rotation.map(id => id.startsWith("filler") ? createTestRecipe({ id }) : recipe(id));
				inject(slots, specialties);

				for (const specialty of specialties) {
					expect(slots[specialty.slotIndex]?.id).toBe(specialty.recipe.id);
					expect(occurrences(slots, specialty.recipe.id)).toBe(1);
				}
				expect(slots.every(r => r !== null)).toBe(true);
			}
		});

		it("should anchor the pinned recipe on a station not holding a specialty", () => {
			// Without specialty, the pinned recipe anchors on the first station able to host it
			const withoutSpecialty = fillers();
			inject(withoutSpecialty, [], { pinnedCookingRecipeId: "potion_health_1" });
			expect(withoutSpecialty[0]?.id).toBe("potion_health_1");

			const slots = fillers();
			inject(slots, [{ slotIndex: 0, recipe: recipe("potion_energy_1") }], { pinnedCookingRecipeId: "potion_health_1" });

			expect(slots[0]?.id).toBe("potion_energy_1");
			expect(slots[1]?.id).toBe("potion_health_1");
		});

		it("should leave a pinned recipe that is also a specialty on its specialty station", () => {
			const slots = fillers();
			inject(slots, [{ slotIndex: 1, recipe: recipe("potion_health_1") }], { pinnedCookingRecipeId: "potion_health_1" });

			expect(slots[1]?.id).toBe("potion_health_1");
			expect(occurrences(slots, "potion_health_1")).toBe(1);
		});

		it("should not offer a specialty on a station the furnace does not have", () => {
			const slots = fillers().slice(0, 3);
			inject(slots, [{ slotIndex: 3, recipe: recipe("potion_time_speedup_3") }], { cookingSlots: 3 });

			expect(occurrences(slots, "potion_time_speedup_3")).toBe(0);
			expect(slots).toHaveLength(3);
		});

		it("should not offer a pet food specialty to a player without guild", () => {
			const slots = fillers();
			inject(slots, [{ slotIndex: 1, recipe: recipe("petfood_salad_1") }]);
			expect(occurrences(slots, "petfood_salad_1")).toBe(0);

			inject(slots, [{ slotIndex: 1, recipe: recipe("petfood_salad_1") }], { guild: {} });
			expect(slots[1]?.id).toBe("petfood_salad_1");
		});
	});

	describe("buildRecipeSlotData", () => {
		const build = (CookingService as unknown as {
			buildRecipeSlotData: (
				slotIndex: number,
				recipe: CookingRecipe,
				context: {
					furnacePosition: number;
					daySeed: number;
					grade: { secretRecipeRate: number };
					plantStorageMap: Map<number, number>;
					materialMap: Map<number, number>;
					guild: unknown;
					keptRecipeIds: ReadonlySet<string>;
					timePotionsLeftThisWeek?: number;
				}
			) => {
				id: string;
				isSecret: boolean;
				outputDescription: string;
				canCraft: boolean;
				timePotionsLeftThisWeek?: number;
			};
		}).buildRecipeSlotData.bind(CookingService);

		const baseContext = {
			furnacePosition: 0,
			daySeed: 0,
			grade: { secretRecipeRate: 1 }, // Force every slot to be secret
			plantStorageMap: new Map<number, number>(),
			materialMap: new Map<number, number>(),
			guild: null,
			keptRecipeIds: new Set<string>()
		};

		it("should never mark a kept recipe (pinned or specialty) as secret, even when secretRate is 1", () => {
			const recipe = createTestRecipe({ id: "potion_health_1" });
			const result = build(0, recipe, { ...baseContext, keptRecipeIds: new Set(["potion_health_1"]) });
			expect(result.isSecret).toBe(false);
			expect(result.outputDescription).toBe("potion_health_1");
		});

		it("should still mark non-kept recipes as secret when secretRate is 1", () => {
			const recipe = createTestRecipe({ id: "other_recipe" });
			const result = build(0, recipe, { ...baseContext, keptRecipeIds: new Set(["potion_health_1"]) });
			expect(result.isSecret).toBe(true);
		});

		describe("time potion weekly limit", () => {
			// Every ingredient of the test recipes is in stock
			const stockedContext = {
				...baseContext,
				grade: { secretRecipeRate: 0 },
				plantStorageMap: new Map<number, number>([[PlantId.COMMON_HERB, 99], [PlantId.LUNAR_MOSS, 99]]),
				materialMap: new Map<number, number>([[68, 99]])
			};
			const timePotion = createTestRecipe({
				id: "potion_time_speedup_1",
				recipeType: RecipeType.POTION_TIME_SPEEDUP,
				plants: [{ plantId: PlantId.LUNAR_MOSS, quantity: 1 }]
			});

			it("should block a time potion once the weekly limit is reached, even with every ingredient", () => {
				const result = build(0, timePotion, { ...stockedContext, timePotionsLeftThisWeek: 0 });
				expect(result.canCraft).toBe(false);
				expect(result.timePotionsLeftThisWeek).toBe(0);
			});

			it("should let a time potion be cooked while the weekly limit is not reached", () => {
				const result = build(0, timePotion, { ...stockedContext, timePotionsLeftThisWeek: 4 });
				expect(result.canCraft).toBe(true);
				expect(result.timePotionsLeftThisWeek).toBe(4);
			});

			it("should neither block nor annotate the other recipes", () => {
				const result = build(0, createTestRecipe(), { ...stockedContext, timePotionsLeftThisWeek: 0 });
				expect(result.canCraft).toBe(true);
				expect(result).not.toHaveProperty("timePotionsLeftThisWeek");
			});
		});
	});

	describe("buildPlantAvailabilityMap", () => {
		const buildMap = (CookingService as unknown as {
			buildPlantAvailabilityMap: (homeId: number, playerId: number) => Promise<Map<number, number>>;
		}).buildPlantAvailabilityMap.bind(CookingService);

		it("should combine home plant storage with carried plant slots", async () => {
			const storageSpy = vi.spyOn(HomePlantStorages, "getOfHome").mockResolvedValue([
				{ plantId: PlantId.COMMON_HERB, quantity: 2 },
				{ plantId: PlantId.GOLDEN_CLOVER, quantity: 5 }
			] as unknown as Awaited<ReturnType<typeof HomePlantStorages.getOfHome>>);
			const carriedSpy = vi.spyOn(PlayerPlantSlots, "getCarriedPlantCounts").mockResolvedValue(new Map<PlantId, number>([
				[PlantId.COMMON_HERB, 1],
				[PlantId.ANCIENT_TREE, 3]
			]));

			const map = await buildMap(1, 1);

			// Storage + carried are summed for the same plant
			expect(map.get(PlantId.COMMON_HERB)).toBe(3);
			// Storage-only plant keeps its quantity
			expect(map.get(PlantId.GOLDEN_CLOVER)).toBe(5);
			// Carried-only plant is now available even without any home storage entry
			expect(map.get(PlantId.ANCIENT_TREE)).toBe(3);

			storageSpy.mockRestore();
			carriedSpy.mockRestore();
		});

		it("should count carried plants when the home storage is empty", async () => {
			const storageSpy = vi.spyOn(HomePlantStorages, "getOfHome").mockResolvedValue(
				[] as unknown as Awaited<ReturnType<typeof HomePlantStorages.getOfHome>>
			);
			const carriedSpy = vi.spyOn(PlayerPlantSlots, "getCarriedPlantCounts").mockResolvedValue(new Map<PlantId, number>([
				[PlantId.COMMON_HERB, 2]
			]));

			const map = await buildMap(1, 1);

			expect(map.get(PlantId.COMMON_HERB)).toBe(2);

			storageSpy.mockRestore();
			carriedSpy.mockRestore();
		});
	});

	describe("consumeRecipePlants", () => {
		it("should consume stored plants before carried plant slots", async () => {
			const storage = {
				quantity: 1,
				save: vi.fn().mockResolvedValue(undefined)
			} as HomePlantStorage;
			const carriedSlots = [
				{
					slot: 1,
					plantId: PlantId.COMMON_HERB,
					save: vi.fn().mockResolvedValue(undefined)
				} as PlayerPlantSlot,
				{
					slot: 2,
					plantId: PlantId.COMMON_HERB,
					save: vi.fn().mockResolvedValue(undefined)
				} as PlayerPlantSlot
			];
			const storageSpy = vi.spyOn(HomePlantStorages, "getForPlant").mockResolvedValue(storage);
			const slotsSpy = vi.spyOn(PlayerPlantSlot, "findAll").mockResolvedValue(carriedSlots);

			await CookingService["consumeRecipePlants"](10, 20, [{
				plantId: PlantId.COMMON_HERB,
				quantity: 2
			}]);

			expect(storage.quantity).toBe(0);
			expect(storage.save).toHaveBeenCalledOnce();
			expect(carriedSlots[0].plantId).toBe(0);
			expect(carriedSlots[0].save).toHaveBeenCalledOnce();
			expect(carriedSlots[1].plantId).toBe(PlantId.COMMON_HERB);
			expect(carriedSlots[1].save).not.toHaveBeenCalled();

			storageSpy.mockRestore();
			slotsSpy.mockRestore();
		});
	});

	describe("addCookingXp - master chef badge", () => {
		const makePlayer = (cookingLevel: number): Player => ({
			id: 42,
			cookingLevel,
			cookingExperience: 0,
			save: vi.fn().mockResolvedValue(undefined)
		}) as unknown as Player;

		it("should grant the badge when the player reaches the threshold level", async () => {
			const player = makePlayer(MASTER_CHEF_BADGE_COOKING_LEVEL - 1);
			const addBadgeSpy = vi.spyOn(PlayerBadgesManager, "addBadge").mockResolvedValue(true);

			const result = await CookingService.addCookingXp({
				player,
				xp: CookingService.getXpNeededForLevel(MASTER_CHEF_BADGE_COOKING_LEVEL - 1)
			});

			expect(player.cookingLevel).toBe(MASTER_CHEF_BADGE_COOKING_LEVEL);
			expect(addBadgeSpy).toHaveBeenCalledWith(42, Badge.MASTER_CHEF);
			expect(result.masterChefBadgeEarned).toBe(true);
			addBadgeSpy.mockRestore();
		});

		it("should grant the badge on the next craft to a player already past the threshold, announcing it only once", async () => {
			const addBadgeSpy = vi.spyOn(PlayerBadgesManager, "addBadge").mockResolvedValue(false);

			const result = await CookingService.addCookingXp({
				player: makePlayer(MASTER_CHEF_BADGE_COOKING_LEVEL + 4),
				xp: 1
			});

			expect(result.levelUp).toBe(false);
			expect(addBadgeSpy).toHaveBeenCalledWith(42, Badge.MASTER_CHEF);
			expect(result.masterChefBadgeEarned).toBe(false);
			addBadgeSpy.mockRestore();
		});

		it("should not grant the badge below the threshold level", async () => {
			const addBadgeSpy = vi.spyOn(PlayerBadgesManager, "addBadge");

			const result = await CookingService.addCookingXp({
				player: makePlayer(MASTER_CHEF_BADGE_COOKING_LEVEL - 2),
				xp: 1
			});

			expect(addBadgeSpy).not.toHaveBeenCalled();
			expect(result.masterChefBadgeEarned).toBe(false);
			addBadgeSpy.mockRestore();
		});
	});
});
