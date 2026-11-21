import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import { RecipeDiscoveryService } from "../../../src/core/cooking/RecipeDiscoveryService";
import PlayerCookingRecipe from "../../../src/core/database/game/models/PlayerCookingRecipe";
import Player from "../../../src/core/database/game/models/Player";
import {
	PLAYER_LEVEL_RECIPE_MILESTONES, RecipeDiscoverySource, RecipeType
} from "../../../../Lib/src/constants/CookingConstants";
import { CookingRecipeDataController } from "../../../src/data/CookingRecipeData";
import { CookingRecipe } from "../../../../Lib/src/types/CookingRecipe";
import { ItemNature } from "../../../../Lib/src/constants/ItemConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";

interface DiscoveredRecipe {
	recipeId: string;
	sourceMapId?: number;
}

/**
 * In-memory stand-in for the player_cooking_recipes table of a single player
 */
function fakeDiscoveryTable(initiallyKnown: string[] = []): DiscoveredRecipe[] {
	const table: DiscoveredRecipe[] = initiallyKnown.map(recipeId => ({ recipeId }));
	vi.spyOn(PlayerCookingRecipe, "isRecipeDiscovered").mockImplementation((_player, recipeId) =>
		Promise.resolve(table.some(row => row.recipeId === recipeId)));
	vi.spyOn(PlayerCookingRecipe, "discoverRecipe").mockImplementation((_player, recipeId, sourceMapId) => {
		table.push({
			recipeId, sourceMapId
		});
		return Promise.resolve();
	});
	vi.spyOn(PlayerCookingRecipe, "getDiscoveredRecipeIds").mockImplementation(() =>
		Promise.resolve(table.map(row => row.recipeId)));
	vi.spyOn(PlayerCookingRecipe, "hasDiscoveredFromMapId").mockImplementation((_player, mapId) =>
		Promise.resolve(table.some(row => row.sourceMapId === mapId)));
	return table;
}

/**
 * Recipes granted by a source, in the order the service is expected to hand them out (level, then id)
 */
function recipesOfSource(source: RecipeDiscoverySource, recipeType?: RecipeType): CookingRecipe[] {
	return CookingRecipeDataController.instance.getAll()
		.filter(recipe => !recipe.discoveredByDefault
			&& recipe.discoverySource === source
			&& (recipeType === undefined || recipe.recipeType === recipeType))
		.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
}

const player = { id: 1 } as Player;

describe("RecipeDiscoveryService", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("discoverFromSource", () => {
		it("should hand out the recipes of the source one by one, lowest level first, then nothing", async () => {
			const table = fakeDiscoveryTable();
			const expectedOrder = recipesOfSource(RecipeDiscoverySource.FARMER);

			const discovered: (string | undefined)[] = [];
			for (let i = 0; i <= expectedOrder.length; i++) {
				discovered.push((await RecipeDiscoveryService.discoverFromSource(player, RecipeDiscoverySource.FARMER))?.id);
			}

			expect(discovered).toEqual([...expectedOrder.map(recipe => recipe.id), undefined]);
			expect(table.map(row => row.recipeId)).toEqual(expectedOrder.map(recipe => recipe.id));
		});

		it("should skip the recipes already known", async () => {
			const [first, second] = recipesOfSource(RecipeDiscoverySource.GASPARD_JO);
			fakeDiscoveryTable([first.id]);

			expect((await RecipeDiscoveryService.discoverFromSource(player, RecipeDiscoverySource.GASPARD_JO))?.id).toBe(second.id);
		});
	});

	describe("countDiscoveredFromSource", () => {
		it("should only count the known recipes of the given source", async () => {
			const [farmerRecipe, otherFarmerRecipe] = recipesOfSource(RecipeDiscoverySource.FARMER);
			const [witchRecipe] = recipesOfSource(RecipeDiscoverySource.WITCH);
			fakeDiscoveryTable([farmerRecipe.id, otherFarmerRecipe.id, witchRecipe.id]);

			expect(await RecipeDiscoveryService.countDiscoveredFromSource(player, RecipeDiscoverySource.FARMER)).toBe(2);
			expect(await RecipeDiscoveryService.countDiscoveredFromSource(player, RecipeDiscoverySource.WITCH)).toBe(1);
			expect(await RecipeDiscoveryService.countDiscoveredFromSource(player, RecipeDiscoverySource.GASPARD_JO)).toBe(0);
		});
	});

	describe("syncProgressionRecipes", () => {
		const source = RecipeDiscoverySource.PLAYER_LEVEL_MILESTONE;

		it("should grant nothing below the first milestone", async () => {
			const table = fakeDiscoveryTable();

			expect(await RecipeDiscoveryService.syncProgressionRecipes(player, source, PLAYER_LEVEL_RECIPE_MILESTONES[0] - 1)).toEqual([]);
			expect(table).toEqual([]);
		});

		it("should grant every recipe up to the reached milestone, inclusive, and only once", async () => {
			const table = fakeDiscoveryTable();
			const expectedRecipes = recipesOfSource(source).slice(0, 2);

			const firstSync = await RecipeDiscoveryService.syncProgressionRecipes(player, source, PLAYER_LEVEL_RECIPE_MILESTONES[1]);
			const secondSync = await RecipeDiscoveryService.syncProgressionRecipes(player, source, PLAYER_LEVEL_RECIPE_MILESTONES[1]);

			expect(firstSync).toEqual(expectedRecipes.map(recipe => ({
				recipeId: recipe.id,
				level: recipe.level,
				recipeType: recipe.recipeType
			})));
			expect(secondSync).toEqual([]);
			expect(table.map(row => row.recipeId)).toEqual(expectedRecipes.map(recipe => recipe.id));
		});

		it("should catch up on a missing recipe of a milestone already passed", async () => {
			const [first, second] = recipesOfSource(source);
			fakeDiscoveryTable([second.id]);

			const granted = await RecipeDiscoveryService.syncProgressionRecipes(player, source, PLAYER_LEVEL_RECIPE_MILESTONES[1]);

			expect(granted.map(recipe => recipe.recipeId)).toEqual([first.id]);
		});
	});

	describe("discoverFromBoss", () => {
		const BOSS_MAP_ID = 42;

		it("should grant the lowest-level boss recipe, remembering the boss that granted it", async () => {
			const table = fakeDiscoveryTable();
			const [expected] = recipesOfSource(RecipeDiscoverySource.ISLAND_BOSS);

			const recipe = await RecipeDiscoveryService.discoverFromBoss(player, BOSS_MAP_ID);

			expect(recipe?.id).toBe(expected.id);
			expect(table).toEqual([{
				recipeId: expected.id, sourceMapId: BOSS_MAP_ID
			}]);
		});

		it("should grant nothing more for a boss that already granted a recipe, but grant one for another boss", async () => {
			const table = fakeDiscoveryTable();
			await RecipeDiscoveryService.discoverFromBoss(player, BOSS_MAP_ID);

			expect(await RecipeDiscoveryService.discoverFromBoss(player, BOSS_MAP_ID)).toBeNull();
			expect(table).toHaveLength(1);

			const [, secondBossRecipe] = recipesOfSource(RecipeDiscoverySource.ISLAND_BOSS);
			expect((await RecipeDiscoveryService.discoverFromBoss(player, BOSS_MAP_ID + 1))?.id).toBe(secondBossRecipe.id);
		});
	});

	describe("discoverWitchRecipe", () => {
		it("should grant the lowest-level witch recipe brewing the nature of the ingredient", async () => {
			fakeDiscoveryTable();
			const [expected] = recipesOfSource(RecipeDiscoverySource.WITCH, RecipeType.POTION_HEALTH);
			const [lowestWitchRecipe] = recipesOfSource(RecipeDiscoverySource.WITCH);
			expect(expected.id).not.toBe(lowestWitchRecipe.id);

			expect((await RecipeDiscoveryService.discoverWitchRecipe(player, ItemNature.HEALTH))?.id).toBe(expected.id);
		});

		it("should fall back to any witch recipe once every recipe of the nature is known", async () => {
			fakeDiscoveryTable(recipesOfSource(RecipeDiscoverySource.WITCH, RecipeType.POTION_HEALTH).map(recipe => recipe.id));
			const [lowestWitchRecipe] = recipesOfSource(RecipeDiscoverySource.WITCH);

			expect((await RecipeDiscoveryService.discoverWitchRecipe(player, ItemNature.HEALTH))?.id).toBe(lowestWitchRecipe.id);
		});

		it("should grant any witch recipe for a nature no recipe brews", async () => {
			fakeDiscoveryTable();
			const [lowestWitchRecipe] = recipesOfSource(RecipeDiscoverySource.WITCH);

			expect((await RecipeDiscoveryService.discoverWitchRecipe(player, ItemNature.NONE))?.id).toBe(lowestWitchRecipe.id);
		});

		it("should grant nothing once every witch recipe is known", async () => {
			fakeDiscoveryTable(recipesOfSource(RecipeDiscoverySource.WITCH).map(recipe => recipe.id));

			expect(await RecipeDiscoveryService.discoverWitchRecipe(player, ItemNature.ENERGY)).toBeNull();
		});
	});

	describe("isCookingLevelRecipeUnlocked", () => {
		it("should never unlock a recipe level no grade prepares without penalty", () => {
			const recipe = {
				...recipesOfSource(RecipeDiscoverySource.COOKING_LEVEL)[0],
				level: 999
			};

			expect(RecipeDiscoveryService.isCookingLevelRecipeUnlocked(recipe, 1000)).toBe(false);
		});
	});

	describe("peekNextDiscovery", () => {
		const COSTS = [100, 200, 300] as const;

		it("should offer the next recipe without discovering it, priced after the number of recipes already bought", async () => {
			const recipes = recipesOfSource(RecipeDiscoverySource.FARMER);
			const table = fakeDiscoveryTable([recipes[0].id]);

			const offer = await RecipeDiscoveryService.peekNextDiscovery(player, RecipeDiscoverySource.FARMER, COSTS);

			expect(offer).toEqual({
				recipe: recipes[1],
				cost: COSTS[1]
			});
			expect(table).toHaveLength(1);
		});

		it("should keep the last price once more recipes were bought than there are prices", async () => {
			const recipes = recipesOfSource(RecipeDiscoverySource.FARMER);
			fakeDiscoveryTable(recipes.slice(0, COSTS.length + 1).map(recipe => recipe.id));

			const offer = await RecipeDiscoveryService.peekNextDiscovery(player, RecipeDiscoverySource.FARMER, COSTS);

			expect(offer?.recipe.id).toBe(recipes[COSTS.length + 1].id);
			expect(offer?.cost).toBe(COSTS[COSTS.length - 1]);
		});

		it("should offer nothing once every recipe of the source is known", async () => {
			fakeDiscoveryTable(recipesOfSource(RecipeDiscoverySource.FARMER).map(recipe => recipe.id));

			expect(await RecipeDiscoveryService.peekNextDiscovery(player, RecipeDiscoverySource.FARMER, COSTS)).toBeNull();
		});
	});

	describe("discoverAndPay", () => {
		const RECIPE_ID = "material_wood_1";
		const COST = 150;
		let buyer: Player;
		let spendMoney: ReturnType<typeof vi.fn>;
		let save: ReturnType<typeof vi.fn>;
		let table: DiscoveredRecipe[];

		beforeEach(() => {
			spendMoney = vi.fn().mockResolvedValue(undefined);
			save = vi.fn().mockResolvedValue(undefined);
			buyer = {
				id: 1, money: COST, spendMoney, save
			} as unknown as Player; // Only the fields read by discoverAndPay, the model needs a database
		});

		it("should discover the recipe and charge its exact price when the player can afford it", async () => {
			table = fakeDiscoveryTable();
			const response: CrowniclesPacket[] = [];

			const bought = await RecipeDiscoveryService.discoverAndPay({
				player: buyer, recipeId: RECIPE_ID, cost: COST, response
			});

			expect(bought).toBe(true);
			expect(table.map(row => row.recipeId)).toEqual([RECIPE_ID]);
			expect(spendMoney).toHaveBeenCalledWith({
				amount: COST,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
			expect(save).toHaveBeenCalledOnce();
		});

		it("should neither discover nor charge when the player lacks a single coin", async () => {
			table = fakeDiscoveryTable();
			buyer.money = COST - 1;

			expect(await RecipeDiscoveryService.discoverAndPay({
				player: buyer, recipeId: RECIPE_ID, cost: COST, response: []
			})).toBe(false);
			expect(table).toEqual([]);
			expect(spendMoney).not.toHaveBeenCalled();
		});

		it("should not charge a recipe the player learnt meanwhile", async () => {
			table = fakeDiscoveryTable([RECIPE_ID]);

			expect(await RecipeDiscoveryService.discoverAndPay({
				player: buyer, recipeId: RECIPE_ID, cost: COST, response: []
			})).toBe(false);
			expect(table).toHaveLength(1);
			expect(spendMoney).not.toHaveBeenCalled();
		});
	});
});
