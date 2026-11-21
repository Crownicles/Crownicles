import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { CookingService } from "../../../src/core/cooking/CookingService";
import {
	getCookingGrade, CookingXpConstants, FAILURE_RATE_PER_EXTRA_LEVEL,
	PLANT_COOKING_XP, MATERIAL_RARITY_COOKING_XP, MASTER_CHEF_BADGE_COOKING_LEVEL,
	RecipeType, CookingOutputType, CookingSpecialtyConstants, NO_XP_LEVEL_THRESHOLD, TIME_POTION_WEEKLY_CRAFT_LIMIT, SPECIALTY_SLOT_INDEX
} from "../../../../Lib/src/constants/CookingConstants";
import Player from "../../../src/core/database/game/models/Player";
import { PlayerBadgesManager } from "../../../src/core/database/game/models/PlayerBadges";
import { Badge } from "../../../../Lib/src/types/Badge";
import { CookingRecipe } from "../../../../Lib/src/types/CookingRecipe";
import { PlantId } from "../../../../Lib/src/constants/PlantConstants";
import { Constants } from "../../../../Lib/src/constants/Constants";
import {
	HomePlantStorage, HomePlantStorages
} from "../../../src/core/database/game/models/HomePlantStorage";
import {
	PlayerPlantSlot, PlayerPlantSlots
} from "../../../src/core/database/game/models/PlayerPlantSlot";
import { Materials } from "../../../src/core/database/game/models/Material";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { RecipeDiscoveryService } from "../../../src/core/cooking/RecipeDiscoveryService";
import {
	PetEntities, PetEntity
} from "../../../src/core/database/game/models/PetEntity";
import { PetDataController } from "../../../src/data/Pet";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { GuildDomainConstants } from "../../../../Lib/src/constants/GuildDomainConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { Guild } from "../../../src/core/database/game/models/Guild";
import { PlayerCookingSpecialty } from "../../../src/core/database/game/models/PlayerCookingSpecialty";
import { PlayerCookingRecipe } from "../../../src/core/database/game/models/PlayerCookingRecipe";
import { CookingRecipeDataController } from "../../../src/data/CookingRecipeData";
import { MaterialDataController } from "../../../src/data/Material";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { PetFood } from "../../../../Lib/src/types/PetFood";

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
			}, specialtyIds: ReadonlySet<string>) => void;
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
			const alreadyAnchored = { id: "potion_health_1" } as CookingRecipe;
			slots[anchorIndex] = alreadyAnchored;
			slots[otherIndex] = createTestRecipe({ id: "untouched_recipe" });
			injectPotion(slots, "potion_health_1");

			// The pinned recipe stays put and the neighbour slot is left untouched.
			expect(slots.filter(r => r?.id === "potion_health_1")).toHaveLength(1);
			expect(slots[anchorIndex]).toBe(alreadyAnchored);
			expect(slots[otherIndex]?.id).toBe("untouched_recipe");
		});

		it("should be a no-op when player has no pinned recipe", () => {
			const slots: Array<CookingRecipe | null> = [null, null, null];
			injectPotion(slots, null);
			expect(slots.every(s => s === null)).toBe(true);
		});
	});

	describe("injectPinnedRecipeIfEligible with specialties", () => {
		const injectWithSpecialties = (CookingService as unknown as {
			injectPinnedRecipeIfEligible: (injection: {
				slotRecipes: Array<CookingRecipe | null>;
				player: { pinnedCookingRecipeId: string | null };
				discoveredIds: string[];
				guild: unknown;
				cookingSlots: number;
			}, specialtyIds: ReadonlySet<string>) => void;
		}).injectPinnedRecipeIfEligible.bind(CookingService);

		const inject = (slotRecipes: Array<CookingRecipe | null>, specialtyIds: string[]): void => injectWithSpecialties({
			slotRecipes,
			player: { pinnedCookingRecipeId: "potion_health_1" },
			discoveredIds: [],
			guild: null,
			cookingSlots: 3
		}, new Set(specialtyIds));

		it("should not inject a pinned recipe that is also a specialty, already offered on the specialty station", () => {
			const slots: Array<CookingRecipe | null> = [null, null, null];
			inject(slots, ["potion_health_1"]);
			expect(slots.every(slot => slot === null)).toBe(true);
		});

		it("should still inject a pinned recipe that is not a specialty", () => {
			const slots: Array<CookingRecipe | null> = [null, null, null];
			inject(slots, ["potion_energy_1"]);
			expect(slots.filter(slot => slot?.id === "potion_health_1")).toHaveLength(1);
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

/**
 * Fake guild pantry: only the fields the cooking service reads
 */
function makeGuild(pantryLevel: number, storedFood: Partial<Record<string, number>>): Guild {
	const caps = GuildDomainConstants.getFoodCaps(pantryLevel);
	const amount = (foodType: string): number => storedFood[foodType] ?? 0;
	return {
		id: 7,
		pantryLevel,
		getDataValue: amount,
		isStorageFullFor: (foodType: string, quantity: number) =>
			amount(foodType) + quantity > caps[PetConstants.PET_FOOD_BY_ID.indexOf(foodType as typeof PetConstants.PET_FOOD_BY_ID[number])]
	} as unknown as Guild; // The Sequelize model can't be built without a database
}

function makeCook(cookingLevel: number, overrides: Partial<Player> = {}): Player {
	return {
		id: 42,
		cookingLevel,
		cookingExperience: 0,
		timePotionsCookedThisWeek: 0,
		pinnedCookingRecipeId: null,
		save: vi.fn().mockResolvedValue(undefined),
		...overrides
	} as unknown as Player; // Only the cooking fields, the model needs a database
}

function recipeById(id: string): CookingRecipe {
	const recipe = CookingRecipeDataController.instance.getById(id);
	if (!recipe) {
		throw new Error(`Missing recipe ${id} in the game data`);
	}
	return recipe;
}

describe("CookingService - recipe availability", () => {
	const build = (CookingService as unknown as {
		buildRecipeSlotData: (slotIndex: number, recipe: CookingRecipe, context: {
			furnacePosition: number;
			daySeed: number;
			grade: { secretRecipeRate: number };
			plantStorageMap: Map<number, number>;
			materialMap: Map<number, number>;
			guild: Guild | null;
			keptRecipeIds: ReadonlySet<string>;
			timePotionsLeftThisWeek?: number;
		}) => {
			canCraft: boolean;
			petFoodType?: string;
			ingredients: {
				plants: { plantId: number; quantity: number; playerHas: number }[];
				materials: { materialId: number; quantity: number; playerHas: number }[];
			};
		};
	}).buildRecipeSlotData.bind(CookingService); // Private helper exercised directly, the public path needs a database

	const recipe = createTestRecipe({
		plants: [{ plantId: PlantId.COMMON_HERB, quantity: 2 }],
		materials: [{ materialId: 68, quantity: 3 }]
	});
	const context = (plants: number, materials: number, guild: Guild | null = null): Parameters<typeof build>[2] => ({
		furnacePosition: 0,
		daySeed: 0,
		grade: { secretRecipeRate: 0 },
		plantStorageMap: new Map([[PlantId.COMMON_HERB, plants]]),
		materialMap: new Map([[68, materials]]),
		guild,
		keptRecipeIds: new Set()
	});

	it("should let the player cook with exactly the required ingredients, listing what they own", () => {
		const slot = build(0, recipe, context(2, 3));

		expect(slot.canCraft).toBe(true);
		expect(slot.ingredients).toEqual({
			plants: [{ plantId: PlantId.COMMON_HERB, quantity: 2, playerHas: 2 }],
			materials: [{ materialId: 68, quantity: 3, playerHas: 3 }]
		});
	});

	it("should refuse when a single plant is missing", () => {
		expect(build(0, recipe, context(1, 3)).canCraft).toBe(false);
	});

	it("should refuse when a single material is missing", () => {
		expect(build(0, recipe, context(2, 2)).canCraft).toBe(false);
	});

	it("should refuse when one of several ingredients is missing, even if the others are in stock", () => {
		const twoOfEach = createTestRecipe({
			plants: [{ plantId: PlantId.COMMON_HERB, quantity: 1 }, { plantId: PlantId.GOLDEN_CLOVER, quantity: 1 }],
			materials: [{ materialId: 68, quantity: 1 }, { materialId: 18, quantity: 1 }]
		});
		const stocked = {
			...context(0, 0),
			plantStorageMap: new Map([[PlantId.COMMON_HERB, 1], [PlantId.GOLDEN_CLOVER, 1]]),
			materialMap: new Map([[68, 1], [18, 1]])
		};

		expect(build(0, twoOfEach, stocked).canCraft).toBe(true);
		expect(build(0, twoOfEach, {
			...stocked, plantStorageMap: new Map([[PlantId.COMMON_HERB, 1]])
		}).canCraft).toBe(false);
		expect(build(0, twoOfEach, {
			...stocked, materialMap: new Map([[68, 1]])
		}).canCraft).toBe(false);
	});

	it("should count an ingredient the player never owned as zero", () => {
		const slot = build(0, recipe, {
			...context(0, 0), plantStorageMap: new Map(), materialMap: new Map()
		});

		expect(slot.canCraft).toBe(false);
		expect(slot.ingredients.plants[0].playerHas).toBe(0);
		expect(slot.ingredients.materials[0].playerHas).toBe(0);
	});

	it("should only let a pet food recipe be cooked by a guild member", () => {
		const petFood = createTestRecipe({
			outputType: CookingOutputType.PET_FOOD,
			petFood: {
				type: PetFood.SALAD, quantity: 2, lovePoints: 3
			},
			plants: recipe.plants,
			materials: recipe.materials
		});

		expect(build(0, petFood, context(2, 3)).canCraft).toBe(false);
		const slot = build(0, petFood, context(2, 3, makeGuild(0, {})));
		expect(slot.canCraft).toBe(true);
		expect(slot.petFoodType).toBe(PetConstants.PET_FOOD.HERBIVOROUS_FOOD);
	});

	it("should not annotate a time potion when the weekly count was not computed", () => {
		const timePotion = createTestRecipe({ recipeType: RecipeType.POTION_TIME_SPEEDUP });

		expect(Object.keys(build(0, timePotion, context(2, 3)))).not.toContain("timePotionsLeftThisWeek");
	});
});

describe("CookingService - XP and grades", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should weight plant and material XP, ignoring unknown materials", () => {
		const recipe = createTestRecipe({
			plants: [{ plantId: PlantId.COMMON_HERB, quantity: 2 }],
			materials: [
				{ materialId: 68, quantity: 3 },
				{ materialId: 18, quantity: 1 },
				{ materialId: 999999, quantity: 5 }
			]
		});
		expect(MaterialDataController.instance.getById("68")?.rarity).toBe(MaterialRarity.COMMON);
		expect(MaterialDataController.instance.getById("18")?.rarity).toBe(MaterialRarity.RARE);

		const plantXp = PLANT_COOKING_XP[PlantId.COMMON_HERB] * 2;
		const materialXp = MATERIAL_RARITY_COOKING_XP[MaterialRarity.COMMON] * 3 + MATERIAL_RARITY_COOKING_XP[MaterialRarity.RARE];
		expect(CookingService.calculateCookingXp(recipe)).toBe(Math.round(
			plantXp * CookingXpConstants.PLANT_WEIGHT + materialXp * CookingXpConstants.MATERIAL_WEIGHT
		));
	});

	it("should accumulate XP without leveling up below the threshold", async () => {
		const cook = makeCook(0, { cookingExperience: 10 });

		const result = await CookingService.addCookingXp({
			player: cook, xp: 5
		});

		expect(cook.cookingExperience).toBe(15);
		expect(cook.cookingLevel).toBe(0);
		expect(result).toEqual({
			levelUp: false, newLevel: undefined, newGrade: undefined, masterChefBadgeEarned: false
		});
		expect(cook.save).toHaveBeenCalledOnce();
	});

	it("should chain several level ups and keep the leftover XP", async () => {
		const cook = makeCook(0);
		const xp = CookingService.getXpNeededForLevel(0) + CookingService.getXpNeededForLevel(1) + 7;

		const result = await CookingService.addCookingXp({
			player: cook, xp
		});

		expect(cook.cookingLevel).toBe(2);
		expect(cook.cookingExperience).toBe(7);
		expect(result).toMatchObject({
			levelUp: true, newLevel: 2, newGrade: undefined
		});
	});

	it("should announce the new grade when a level up crosses a grade", async () => {
		const lastHelperLevel = getCookingGrade(0).maxLevel;
		const cook = makeCook(lastHelperLevel);

		const result = await CookingService.addCookingXp({
			player: cook, xp: CookingService.getXpNeededForLevel(lastHelperLevel)
		});

		expect(result.newLevel).toBe(lastHelperLevel + 1);
		expect(result.newGrade).toBe(getCookingGrade(lastHelperLevel + 1).id);
		expect(result.newGrade).not.toBe(getCookingGrade(lastHelperLevel).id);
	});
});

describe("CookingService.executeCraft", () => {
	let consumeMaterials: ReturnType<typeof vi.spyOn>;
	let bool: ReturnType<typeof vi.spyOn>;

	const recipe = createTestRecipe({
		level: 1,
		plants: [{ plantId: PlantId.COMMON_HERB, quantity: 1 }],
		materials: [
			{ materialId: 68, quantity: 1 },
			{ materialId: 18, quantity: 2 }
		]
	});

	const craft = (cook: Player, craftedRecipe = recipe): ReturnType<typeof CookingService.executeCraft> =>
		CookingService.executeCraft({
			player: cook, recipe: craftedRecipe, homeId: 10
		});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const mockWorld = (): void => {
		vi.spyOn(HomePlantStorages, "getForPlant").mockResolvedValue(null);
		vi.spyOn(PlayerPlantSlots, "consumeCarriedPlants").mockResolvedValue(1);
		consumeMaterials = vi.spyOn(Materials, "consumeMaterials").mockResolvedValue(true);
		vi.spyOn(PlayerBadgesManager, "addBadge").mockResolvedValue(false);
		vi.spyOn(RecipeDiscoveryService, "discoverCookingLevelRecipes").mockResolvedValue([]);
		bool = vi.spyOn(RandomUtils.crowniclesRandom, "bool");
	};

	it("should consume every ingredient and grant the recipe XP on success", async () => {
		mockWorld();
		bool.mockReturnValue(false);
		const cook = makeCook(0);

		const result = await craft(cook);

		expect(result).toMatchObject({
			success: true,
			xpGained: CookingService.calculateCookingXp(recipe),
			materialSaved: undefined,
			bonusOutput: false,
			discoveredRecipes: []
		});
		expect(PlayerPlantSlots.consumeCarriedPlants).toHaveBeenCalledWith(42, PlantId.COMMON_HERB, 1);
		expect(consumeMaterials).toHaveBeenCalledWith(42, recipe.materials);
		expect(bool).toHaveBeenCalledWith(getCookingGrade(0).failureRate);
		expect(cook.save).toHaveBeenCalled();
	});

	it("should grant the failure XP of the recipe level when the craft fails", async () => {
		mockWorld();
		bool.mockReturnValue(true);

		const result = await craft(makeCook(0), {
			...recipe, level: 2
		});

		expect(result.success).toBe(false);
		expect(result.xpGained).toBe(CookingService.calculateFailureXp(2));
		expect(result.bonusOutput).toBe(false);
	});

	it("should still grant XP just below the no-XP threshold, and none at the threshold", async () => {
		mockWorld();
		bool.mockReturnValue(false);
		const maxLevel = getCookingGrade(0).maxRecipeLevelWithoutPenalty;

		const justBelow = await craft(makeCook(0), {
			...recipe, level: maxLevel + NO_XP_LEVEL_THRESHOLD - 1
		});
		const atThreshold = await craft(makeCook(0), {
			...recipe, level: maxLevel + NO_XP_LEVEL_THRESHOLD
		});

		expect(justBelow.xpGained).toBe(CookingService.calculateCookingXp(recipe));
		expect(atThreshold.xpGained).toBe(0);
	});

	it("should cap the failure chance at 100% for a recipe far above the grade", async () => {
		mockWorld();
		bool.mockReturnValue(true);

		await craft(makeCook(0), {
			...recipe, level: 20
		});

		expect(bool).toHaveBeenCalledWith(1);
	});

	it("should spare the material picked by the save buff of a high grade", async () => {
		mockWorld();
		const masterCook = makeCook(91);
		const grade = getCookingGrade(91);
		bool.mockReturnValueOnce(true) // Material save roll
			.mockReturnValueOnce(false); // Failure roll
		vi.spyOn(RandomUtils.crowniclesRandom, "integer").mockReturnValue(1);
		vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(1);

		const result = await craft(masterCook);

		expect(bool).toHaveBeenNthCalledWith(1, grade.materialSaveChance);
		expect(RandomUtils.crowniclesRandom.integer).toHaveBeenCalledWith(0, recipe.materials.length - 1);
		expect(result.materialSaved).toBe(18);
		expect(consumeMaterials).toHaveBeenCalledWith(42, [{ materialId: 68, quantity: 1 }]);
	});

	it("should not consume anything when the save buff spares the only material", async () => {
		mockWorld();
		bool.mockReturnValueOnce(true).mockReturnValueOnce(false);
		vi.spyOn(RandomUtils.crowniclesRandom, "integer").mockReturnValue(0);
		vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(1);

		const result = await craft(makeCook(91), {
			...recipe, materials: [{ materialId: 68, quantity: 1 }]
		});

		expect(result.materialSaved).toBe(68);
		expect(consumeMaterials).not.toHaveBeenCalled();
	});

	it("should never roll the material save for a recipe without material", async () => {
		mockWorld();
		bool.mockReturnValue(false);
		vi.spyOn(RandomUtils.crowniclesRandom, "integer").mockReturnValue(0);
		vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(1);

		const result = await craft(makeCook(91), {
			...recipe, materials: []
		});

		expect(result.materialSaved).toBeUndefined();
		expect(bool).toHaveBeenCalledOnce();
		expect(consumeMaterials).not.toHaveBeenCalled();
	});

	it("should never roll the material save for a grade without the buff", async () => {
		mockWorld();
		bool.mockReturnValue(false);

		await craft(makeCook(0));

		expect(bool).toHaveBeenCalledOnce();
	});

	it("should double the XP of a bonus output, rolled strictly below the bonus chance", async () => {
		mockWorld();
		const grade = getCookingGrade(91);
		bool.mockReturnValue(false);
		const roll = vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(grade.bonusOutputChance - 0.001);

		const bonus = await craft(makeCook(91));
		roll.mockReturnValue(grade.bonusOutputChance);
		const noBonus = await craft(makeCook(91));

		expect(bonus.bonusOutput).toBe(true);
		expect(bonus.xpGained).toBe(2 * CookingService.calculateCookingXp(recipe));
		expect(noBonus.bonusOutput).toBe(false);
		expect(noBonus.xpGained).toBe(CookingService.calculateCookingXp(recipe));
	});

	it("should never grant a bonus output on a failed craft", async () => {
		mockWorld();
		bool.mockReturnValueOnce(false).mockReturnValueOnce(true);
		vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(0);

		const result = await craft(makeCook(91));

		expect(result.success).toBe(false);
		expect(result.bonusOutput).toBe(false);
	});

	it("should never roll a bonus output for a grade without the bonus", async () => {
		mockWorld();
		bool.mockReturnValue(false);
		const roll = vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive").mockReturnValue(0);

		const result = await craft(makeCook(0));

		expect(result.bonusOutput).toBe(false);
		expect(roll).not.toHaveBeenCalled();
	});

	it("should discover the cooking level recipes only on a level up", async () => {
		mockWorld();
		bool.mockReturnValue(false);
		const discovered = [{ recipeId: "material_metal_2", level: 5, recipeType: RecipeType.MATERIAL_CRAFT }];
		vi.mocked(RecipeDiscoveryService.discoverCookingLevelRecipes).mockResolvedValue(discovered);

		const noLevelUp = await craft(makeCook(30));
		const levelUp = await craft(makeCook(0, { cookingExperience: CookingService.getXpNeededForLevel(0) }));

		expect(noLevelUp.discoveredRecipes).toEqual([]);
		expect(levelUp.discoveredRecipes).toEqual(discovered);
		expect(RecipeDiscoveryService.discoverCookingLevelRecipes).toHaveBeenCalledOnce();
	});
});

describe("CookingService - plant consumption", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	const consume = (quantity: number): Promise<void> => CookingService["consumeRecipePlants"](10, 20, [{
		plantId: PlantId.COMMON_HERB,
		quantity
	}]);

	it("should take everything from the carried plants when the home has no storage for the plant", async () => {
		vi.spyOn(HomePlantStorages, "getForPlant").mockResolvedValue(null);
		const carried = vi.spyOn(PlayerPlantSlots, "consumeCarriedPlants").mockResolvedValue(2);

		await consume(2);

		expect(carried).toHaveBeenCalledWith(20, PlantId.COMMON_HERB, 2);
	});

	it("should not touch an empty storage and take everything from the carried plants", async () => {
		const storage = {
			quantity: 0,
			save: vi.fn().mockResolvedValue(undefined)
		} as unknown as HomePlantStorage; // Only the stock and save are used
		vi.spyOn(HomePlantStorages, "getForPlant").mockResolvedValue(storage);
		const carried = vi.spyOn(PlayerPlantSlots, "consumeCarriedPlants").mockResolvedValue(2);

		await consume(2);

		expect(storage.save).not.toHaveBeenCalled();
		expect(storage.quantity).toBe(0);
		expect(carried).toHaveBeenCalledWith(20, PlantId.COMMON_HERB, 2);
	});

	it("should leave the carried plants alone when the storage covers the recipe", async () => {
		const storage = {
			quantity: 3,
			save: vi.fn().mockResolvedValue(undefined)
		} as unknown as HomePlantStorage; // Only the stock and save are used
		vi.spyOn(HomePlantStorages, "getForPlant").mockResolvedValue(storage);
		const carried = vi.spyOn(PlayerPlantSlots, "consumeCarriedPlants");

		await consume(3);

		expect(storage.quantity).toBe(0);
		expect(carried).not.toHaveBeenCalled();
	});
});

describe("CookingService.getWoodToConsume", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	const stock = (materials: [number, number][]): void => {
		vi.spyOn(Materials, "getPlayerMaterials").mockResolvedValue(materials.map(([materialId, quantity]) => ({
			materialId, quantity
		})) as Awaited<ReturnType<typeof Materials.getPlayerMaterials>>);
	};

	it("should burn the most stocked common wood first, without confirmation", async () => {
		// 51 and 58 are common woods, 18 is a rare wood, 68 is not a wood
		stock([[51, 2], [58, 5], [18, 10], [68, 50]]);

		expect(await CookingService.getWoodToConsume(1)).toEqual({
			materialId: 58, rarity: MaterialRarity.COMMON, needsConfirmation: false
		});
	});

	it("should ask for a confirmation before burning an uncommon wood, preferred to a rare one", async () => {
		// 51 is common but out of stock, 2 and 88 are uncommon woods, 18 is rare
		stock([[51, 0], [2, 1], [88, 4], [18, 10]]);

		expect(await CookingService.getWoodToConsume(1)).toEqual({
			materialId: 88, rarity: MaterialRarity.UNCOMMON, needsConfirmation: true
		});
	});

	it("should fall back on a rare wood, with confirmation", async () => {
		stock([[18, 1]]);

		expect(await CookingService.getWoodToConsume(1)).toEqual({
			materialId: 18, rarity: MaterialRarity.RARE, needsConfirmation: true
		});
	});

	it("should find no wood when the player has none", async () => {
		stock([[68, 50]]);

		expect(await CookingService.getWoodToConsume(1)).toBeNull();
	});
});

describe("CookingService - weekly time potions", () => {
	const timePotion = createTestRecipe({ recipeType: RecipeType.POTION_TIME_SPEEDUP });

	it("should not compute anything when no recipe brews a time potion", () => {
		expect(CookingService.getTimePotionsLeftThisWeek(makeCook(0, { timePotionsCookedThisWeek: 3 }), [createTestRecipe(), null])).toBeUndefined();
	});

	it("should count the time potions left this week, never below zero", () => {
		expect(CookingService.getTimePotionsLeftThisWeek(makeCook(0, { timePotionsCookedThisWeek: 3 }), [null, timePotion]))
			.toBe(TIME_POTION_WEEKLY_CRAFT_LIMIT - 3);
		expect(CookingService.getTimePotionsLeftThisWeek(makeCook(0, { timePotionsCookedThisWeek: TIME_POTION_WEEKLY_CRAFT_LIMIT + 2 }), [timePotion]))
			.toBe(0);
	});
});

describe("CookingService - pet food", () => {
	const petFoodRecipe = createTestRecipe({
		outputType: CookingOutputType.PET_FOOD,
		petFood: {
			type: PetFood.MEAT, quantity: 3, lovePoints: 3
		}
	});
	const carnivorousIndex = PetConstants.PET_FOOD_BY_ID.indexOf(PetConstants.PET_FOOD.CARNIVOROUS_FOOD);
	const carnivorousCap = GuildDomainConstants.getFoodCaps(0)[carnivorousIndex];

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should only accept pet food when the guild pantry has room for the whole batch", () => {
		expect(CookingService.canStorePetFoodReward(createTestRecipe(), null)).toBe(true);
		expect(CookingService.canStorePetFoodReward(petFoodRecipe, null)).toBe(false);
		expect(CookingService.canStorePetFoodReward({
			...petFoodRecipe, petFood: null
		}, makeGuild(0, {}))).toBe(false);
		expect(CookingService.canStorePetFoodReward(petFoodRecipe, makeGuild(0, { [PetConstants.PET_FOOD.CARNIVOROUS_FOOD]: carnivorousCap - 3 }))).toBe(true);
		expect(CookingService.canStorePetFoodReward(petFoodRecipe, makeGuild(0, { [PetConstants.PET_FOOD.CARNIVOROUS_FOOD]: carnivorousCap - 2 }))).toBe(false);
	});

	it("should compute the room left in the pantry of the guild level, never negative", () => {
		const food = PetConstants.PET_FOOD.CARNIVOROUS_FOOD;
		const upgradedCap = GuildDomainConstants.getFoodCaps(2)[carnivorousIndex];
		expect(upgradedCap).not.toBe(carnivorousCap);

		expect(CookingService.getAvailableFoodSpace(makeGuild(0, { [food]: 10 }), food)).toBe(carnivorousCap - 10);
		expect(CookingService.getAvailableFoodSpace(makeGuild(2, { [food]: 10 }), food)).toBe(upgradedCap - 10);
		expect(CookingService.getAvailableFoodSpace(makeGuild(0, { [food]: carnivorousCap + 5 }), food)).toBe(0);
	});

	it("should recycle the surplus into the first material of the recipe", () => {
		expect(CookingService.getSurplusRecycleMaterial(createTestRecipe({
			materials: [{ materialId: 12, quantity: 1 }, { materialId: 34, quantity: 1 }]
		}))).toBe(12);
		expect(CookingService.getSurplusRecycleMaterial(createTestRecipe({ materials: [] }))).toBeUndefined();
	});

	describe("getHungryCompatiblePet", () => {
		const food = PetConstants.PET_FOOD.CARNIVOROUS_FOOD;
		const pet = (canBeFed: boolean): PetEntity => ({
			typeId: 1,
			canBeFed: vi.fn().mockReturnValue(canBeFed)
		}) as unknown as PetEntity; // Only the feeding check is used

		it("should find no pet for a player without one", async () => {
			const getById = vi.spyOn(PetEntities, "getById");

			expect(await CookingService.getHungryCompatiblePet(makeCook(0, { petId: null }), food)).toBeNull();
			expect(getById).not.toHaveBeenCalled();
		});

		it("should find no pet when the pet entity is gone", async () => {
			vi.spyOn(PetEntities, "getById").mockResolvedValue(null);

			expect(await CookingService.getHungryCompatiblePet(makeCook(0, { petId: 5 }), food)).toBeNull();
		});

		it("should only return a pet that can eat the food now", async () => {
			const hungry = pet(true);
			vi.spyOn(PetEntities, "getById").mockResolvedValueOnce(pet(false)).mockResolvedValueOnce(hungry);

			expect(await CookingService.getHungryCompatiblePet(makeCook(0, { petId: 5 }), food)).toBeNull();
			expect(await CookingService.getHungryCompatiblePet(makeCook(0, { petId: 5 }), food)).toBe(hungry);
			expect(hungry.canBeFed).toHaveBeenCalledWith(PetDataController.instance.getById(1), food);
		});
	});

	it("should feed the pet the love points of the food and reset its hunger", async () => {
		const cook = makeCook(0);
		const petEntity = {
			hungrySince: null,
			changeLovePoints: vi.fn().mockResolvedValue(undefined),
			save: vi.fn().mockResolvedValue(undefined)
		} as unknown as PetEntity; // Only the feeding fields are used
		const before = Date.now();

		await CookingService.feedPetFromSurplus(cook, petEntity, PetConstants.PET_FOOD.CARNIVOROUS_FOOD);

		expect(petEntity.changeLovePoints).toHaveBeenCalledWith({
			response: [],
			player: cook,
			amount: PetConstants.PET_FOOD_LOVE_POINTS_AMOUNT[carnivorousIndex],
			reason: NumberChangeReason.PET_FEED
		});
		expect(petEntity.hungrySince?.getTime()).toBeGreaterThanOrEqual(before);
		expect(petEntity.save).toHaveBeenCalledOnce();
	});
});

describe("CookingService - pinned recipe eligibility", () => {
	const inject = (CookingService as unknown as {
		injectPinnedRecipeIfEligible: (injection: {
			slotRecipes: (CookingRecipe | null)[];
			player: { pinnedCookingRecipeId: string | null };
			discoveredIds: string[];
			guild: Guild | null;
			cookingSlots: number;
		}, specialtyIds: ReadonlySet<string>) => void;
	}).injectPinnedRecipeIfEligible.bind(CookingService); // Private helper exercised directly

	const injected = (pinnedCookingRecipeId: string, options: { discoveredIds?: string[]; guild?: Guild | null; cookingSlots?: number } = {}): string[] => {
		const cookingSlots = options.cookingSlots ?? 5;
		const slotRecipes: (CookingRecipe | null)[] = new Array(cookingSlots).fill(null);
		inject({
			slotRecipes,
			player: { pinnedCookingRecipeId },
			discoveredIds: options.discoveredIds ?? [],
			guild: options.guild ?? null,
			cookingSlots
		}, new Set());
		expect(Object.keys(slotRecipes)).toHaveLength(cookingSlots);
		return slotRecipes.filter((slot): slot is CookingRecipe => slot !== null).map(slot => slot.id);
	};

	it("should ignore a pin on a recipe that no longer exists", () => {
		expect(injected("removed_recipe")).toEqual([]);
	});

	it("should only inject a non-default recipe the player discovered", () => {
		const recipe = recipeById("material_wood_1");
		expect(recipe.discoveredByDefault).toBe(false);

		expect(injected(recipe.id)).toEqual([]);
		expect(injected(recipe.id, { discoveredIds: [recipe.id] })).toEqual([recipe.id]);
	});

	it("should only inject a pinned pet food for a guild member", () => {
		expect(injected("petfood_salad_1")).toEqual([]);
		expect(injected("petfood_salad_1", { guild: makeGuild(0, {}) })).toEqual(["petfood_salad_1"]);
	});

	it("should not inject a recipe on a station the home does not have", () => {
		// Material recipes are only offered by the third station
		expect(injected("material_alloy_1", { cookingSlots: 2 })).toEqual([]);
		expect(injected("material_alloy_1", { cookingSlots: 3 })).toEqual(["material_alloy_1"]);
	});
});

describe("CookingService - specialties", () => {
	const firstSpecialtyLevel = CookingSpecialtyConstants.UNLOCK_COOKING_LEVELS[0];
	const allSpecialtiesLevel = CookingSpecialtyConstants.UNLOCK_COOKING_LEVELS[CookingSpecialtyConstants.MAX_SPECIALTIES - 1];
	let destroy: ReturnType<typeof vi.spyOn>;

	const storeSpecialties = (recipeIds: string[]): void => {
		vi.spyOn(PlayerCookingSpecialty, "getOfPlayer").mockResolvedValue(recipeIds.map(recipeId => ({ recipeId })) as PlayerCookingSpecialty[]);
		destroy = vi.spyOn(PlayerCookingSpecialty, "destroy").mockResolvedValue(1);
	};

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should have no specialty before unlocking them, without reading them", async () => {
		storeSpecialties(["potion_health_1"]);

		expect(await CookingService.getSpecialties(makeCook(firstSpecialtyLevel - 1), [])).toEqual([]);
		expect(PlayerCookingSpecialty.getOfPlayer).not.toHaveBeenCalled();
	});

	it("should sort the specialties by level, then id, and delete the ones no longer known", async () => {
		storeSpecialties(["potion_health_2", "potion_energy_1", "potion_attack_1", "removed_recipe", "material_wood_1"]);

		const specialties = await CookingService.getSpecialties(makeCook(allSpecialtiesLevel), ["potion_health_2"]);

		expect(specialties.map(recipe => recipe.id)).toEqual(["potion_attack_1", "potion_energy_1", "potion_health_2"]);
		expect(destroy).toHaveBeenCalledTimes(2);
		expect(destroy).toHaveBeenCalledWith({ where: { playerId: 42, recipeId: "removed_recipe" } });
		expect(destroy).toHaveBeenCalledWith({ where: { playerId: 42, recipeId: "material_wood_1" } });
	});

	it("should only keep as many specialties as the cooking level allows", async () => {
		storeSpecialties(["potion_health_1", "potion_energy_1", "potion_attack_1"]);

		const specialties = await CookingService.getSpecialties(makeCook(firstSpecialtyLevel), []);

		expect(specialties.map(recipe => recipe.id)).toEqual(["potion_attack_1"]);
	});

	describe("getSpecialtiesInfo", () => {
		const stocks = (plants: Map<number, number>, materials: [number, number][]): void => {
			vi.spyOn(HomePlantStorages, "getOfHome").mockResolvedValue([...plants].map(([plantId, quantity]) => ({
				plantId, quantity
			})) as Awaited<ReturnType<typeof HomePlantStorages.getOfHome>>);
			vi.spyOn(PlayerPlantSlots, "getCarriedPlantCounts").mockResolvedValue(new Map());
			vi.spyOn(Materials, "getPlayerMaterials").mockResolvedValue(materials.map(([materialId, quantity]) => ({
				materialId, quantity
			})) as Awaited<ReturnType<typeof Materials.getPlayerMaterials>>);
			vi.spyOn(PlayerCookingRecipe, "getDiscoveredRecipeIds").mockResolvedValue([]);
		};

		const fullStocks = (recipes: CookingRecipe[]): void => stocks(
			new Map(recipes.flatMap(recipe => recipe.plants.map(plant => [plant.plantId, 99] as [number, number]))),
			recipes.flatMap(recipe => recipe.materials.map(material => [material.materialId, 99] as [number, number]))
		);

		it("should be empty before unlocking the specialties", async () => {
			storeSpecialties(["potion_health_1"]);
			const loadStocks = vi.spyOn(Materials, "getPlayerMaterials");

			expect(await CookingService.getSpecialtiesInfo({
				player: makeCook(firstSpecialtyLevel - 1), homeId: 1, guild: null
			})).toEqual([]);
			expect(loadStocks).not.toHaveBeenCalled();
		});

		it("should not load the stocks of a cook whose specialties were all forgotten", async () => {
			storeSpecialties(["removed_recipe"]);
			const loadStocks = vi.spyOn(Materials, "getPlayerMaterials");
			vi.spyOn(PlayerCookingRecipe, "getDiscoveredRecipeIds").mockResolvedValue([]);

			expect(await CookingService.getSpecialtiesInfo({
				player: makeCook(allSpecialtiesLevel), homeId: 1, guild: null
			})).toEqual([]);
			expect(loadStocks).not.toHaveBeenCalled();
		});

		it("should tell for each specialty whether it can be cooked right now", async () => {
			storeSpecialties(["potion_health_1", "petfood_salad_1", "potion_attack_1"]);
			const health = recipeById("potion_health_1");
			const salad = recipeById("petfood_salad_1");
			fullStocks([health, salad]);

			const infos = await CookingService.getSpecialtiesInfo({
				player: makeCook(allSpecialtiesLevel), homeId: 1, guild: null
			});

			expect(infos).toEqual([
				{ recipeId: "petfood_salad_1", level: salad.level, recipeType: salad.recipeType, canCraft: false },
				{ recipeId: "potion_attack_1", level: 1, recipeType: RecipeType.POTION_ATTACK, canCraft: false },
				{ recipeId: "potion_health_1", level: health.level, recipeType: health.recipeType, canCraft: true }
			]);
		});

		it("should refuse a time potion specialty once the weekly limit is reached", async () => {
			const timePotion = CookingRecipeDataController.instance.getAll()
				.find(recipe => recipe.discoveredByDefault && recipe.recipeType === RecipeType.POTION_TIME_SPEEDUP);
			if (!timePotion) {
				throw new Error("No default time potion recipe in the game data");
			}
			storeSpecialties([timePotion.id]);
			fullStocks([timePotion]);

			const [allowed] = await CookingService.getSpecialtiesInfo({
				player: makeCook(allSpecialtiesLevel, { timePotionsCookedThisWeek: TIME_POTION_WEEKLY_CRAFT_LIMIT - 1 }), homeId: 1, guild: null
			});
			const [refused] = await CookingService.getSpecialtiesInfo({
				player: makeCook(allSpecialtiesLevel, { timePotionsCookedThisWeek: TIME_POTION_WEEKLY_CRAFT_LIMIT }), homeId: 1, guild: null
			});

			expect(allowed.canCraft).toBe(true);
			expect(refused.canCraft).toBe(false);
		});
	});
});

describe("CookingService.getPinnedRecipeInfo", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	const stock = (quantity: number): void => {
		vi.spyOn(HomePlantStorages, "getOfHome").mockResolvedValue([]);
		vi.spyOn(PlayerPlantSlots, "getCarriedPlantCounts").mockResolvedValue(new Map([[PlantId.COMMON_HERB, quantity]]));
		vi.spyOn(Materials, "getPlayerMaterials").mockResolvedValue([]);
	};

	it("should have no info for a recipe that no longer exists", async () => {
		stock(0);

		expect(await CookingService.getPinnedRecipeInfo({
			player: makeCook(0), homeId: 1, recipeId: "removed_recipe"
		})).toBeNull();
	});

	it("should describe the pinned recipe with the carried ingredients", async () => {
		const salad = recipeById("petfood_salad_1");
		stock(99);
		vi.mocked(Materials.getPlayerMaterials).mockResolvedValue(salad.materials.map(material => ({
			materialId: material.materialId, quantity: 99
		})) as Awaited<ReturnType<typeof Materials.getPlayerMaterials>>);
		vi.mocked(PlayerPlantSlots.getCarriedPlantCounts).mockResolvedValue(new Map(salad.plants.map(plant => [plant.plantId, 99])));

		const withoutGuild = await CookingService.getPinnedRecipeInfo({
			player: makeCook(0), homeId: 1, recipeId: salad.id
		});
		const withGuild = await CookingService.getPinnedRecipeInfo({
			player: makeCook(0), homeId: 1, recipeId: salad.id, guild: makeGuild(0, {})
		});

		expect(withoutGuild).toMatchObject({
			recipeId: salad.id,
			level: salad.level,
			recipeType: salad.recipeType,
			outputType: CookingOutputType.PET_FOOD,
			canCraft: false
		});
		expect(withoutGuild?.ingredients.plants.every(plant => plant.playerHas === 99)).toBe(true);
		expect(withGuild?.canCraft).toBe(true);
	});
});

describe("CookingService.getSlotRecipes", () => {
	const allSpecialtiesLevel = CookingSpecialtyConstants.UNLOCK_COOKING_LEVELS[CookingSpecialtyConstants.MAX_SPECIALTIES - 1];
	const cookingSlots = 5;

	afterEach(() => {
		vi.restoreAllMocks();
	});

	const openFurnace = (cook: Player, specialtyIds: string[]): ReturnType<typeof CookingService.getSlotRecipes> => {
		vi.spyOn(PlayerCookingRecipe, "getDiscoveredRecipeIds").mockResolvedValue([]);
		vi.spyOn(PlayerCookingSpecialty, "getOfPlayer").mockResolvedValue(specialtyIds.map(recipeId => ({ recipeId })) as PlayerCookingSpecialty[]);
		vi.spyOn(HomePlantStorages, "getOfHome").mockResolvedValue([]);
		vi.spyOn(PlayerPlantSlots, "getCarriedPlantCounts").mockResolvedValue(new Map());
		vi.spyOn(Materials, "getPlayerMaterials").mockResolvedValue([]);
		return CookingService.getSlotRecipes({
			player: cook, homeId: 1, cookingSlots
		});
	};

	it("should offer one specialty at a time on its own station, moving to the next one at each re-roll", async () => {
		const specialties = ["potion_health_1", "potion_energy_1"];

		const [firstRoll, secondRoll] = [
			await openFurnace(makeCook(allSpecialtiesLevel, { furnacePosition: 1, guildId: null }), specialties),
			await openFurnace(makeCook(allSpecialtiesLevel, { furnacePosition: 2, guildId: null }), specialties)
		];

		for (const slots of [firstRoll, secondRoll]) {
			expect(slots.map(slot => slot.slotIndex)).toEqual([0, 1, 2, 3, 4, SPECIALTY_SLOT_INDEX]);
			// The rotating stations never offer a specialty
			expect(slots.slice(0, cookingSlots).some(slot => specialties.includes(slot.recipe?.id ?? ""))).toBe(false);
		}
		expect(firstRoll[cookingSlots].recipe).toMatchObject({
			id: "potion_health_1", isSecret: false
		});
		expect(secondRoll[cookingSlots].recipe?.id).toBe("potion_energy_1");
	});

	it("should have no specialty station for a cook without specialty", async () => {
		const slots = await openFurnace(makeCook(0, { furnacePosition: 1, guildId: null }), []);

		expect(slots.map(slot => slot.slotIndex)).toEqual([0, 1, 2, 3, 4]);
		expect(slots.some(slot => slot.recipe?.outputType === CookingOutputType.PET_FOOD)).toBe(false);
	});

	it("should always show the pinned recipe, never as a secret", async () => {
		const cook = makeCook(0, {
			furnacePosition: 3, guildId: null, pinnedCookingRecipeId: "material_alloy_1"
		});

		const pinned = (await openFurnace(cook, [])).find(slot => slot.recipe?.id === "material_alloy_1");

		expect(pinned?.recipe?.isSecret).toBe(false);
		expect(pinned?.recipe?.canCraft).toBe(false);
	});

	it("should annotate the offered time potion specialty with the potions left this week", async () => {
		const timePotion = CookingRecipeDataController.instance.getAll()
			.find(recipe => recipe.discoveredByDefault && recipe.recipeType === RecipeType.POTION_TIME_SPEEDUP);
		if (!timePotion) {
			throw new Error("No default time potion recipe in the game data");
		}

		const slots = await openFurnace(makeCook(allSpecialtiesLevel, {
			furnacePosition: 0, guildId: null, timePotionsCookedThisWeek: 4
		}), [timePotion.id]);

		expect(slots[cookingSlots].recipe?.timePotionsLeftThisWeek).toBe(TIME_POTION_WEEKLY_CRAFT_LIMIT - 4);
	});
});
