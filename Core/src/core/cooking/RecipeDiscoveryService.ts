import {
	RecipeDiscoverySource, RecipeType
} from "../../../../Lib/src/constants/CookingConstants";
import { recipeRegistry } from "./RecipeRegistry";
import PlayerCookingRecipe from "../database/game/models/PlayerCookingRecipe";
import Player from "../database/game/models/Player";
import { CookingRecipe } from "../../../../Lib/src/types/CookingRecipe";
import { ItemNature } from "../../../../Lib/src/constants/ItemConstants";

/**
 * Maps ItemNature (potion nature) to the corresponding RecipeType
 */
const POTION_NATURE_TO_RECIPE_TYPE: Partial<Record<ItemNature, RecipeType>> = {
	[ItemNature.HEALTH]: RecipeType.POTION_HEALTH,
	[ItemNature.ENERGY]: RecipeType.POTION_ENERGY,
	[ItemNature.TIME_SPEEDUP]: RecipeType.POTION_TIME_SPEEDUP,
	[ItemNature.DEFENSE]: RecipeType.POTION_DEFENSE,
	[ItemNature.ATTACK]: RecipeType.POTION_ATTACK,
	[ItemNature.SPEED]: RecipeType.POTION_SPEED
};

export class RecipeDiscoveryService {
	/**
	 * Discover a recipe from a given source for a player.
	 * Picks the lowest-level undiscovered recipe matching the source.
	 * Returns the discovered recipe or null if none available.
	 */
	static async discoverFromSource(player: Player, source: RecipeDiscoverySource): Promise<CookingRecipe | null> {
		const candidates = recipeRegistry.getAll()
			.filter(r => !r.discoveredByDefault && r.discoverySource === source)
			.sort((a, b) => a.level - b.level);

		for (const recipe of candidates) {
			if (!await PlayerCookingRecipe.isRecipeDiscovered(player, recipe.id)) {
				await PlayerCookingRecipe.discoverRecipe(player, recipe.id);
				return recipe;
			}
		}
		return null;
	}

	/**
	 * Discover a recipe from an island boss defeat.
	 * Each unique boss (by mapId) can only grant one recipe per player.
	 */
	static async discoverFromBoss(player: Player, bossMapId: number): Promise<CookingRecipe | null> {
		if (await PlayerCookingRecipe.hasDiscoveredFromMapId(player, bossMapId)) {
			return null;
		}

		const candidates = recipeRegistry.getAll()
			.filter(r => !r.discoveredByDefault && r.discoverySource === RecipeDiscoverySource.ISLAND_BOSS)
			.sort((a, b) => a.level - b.level);

		for (const recipe of candidates) {
			if (!await PlayerCookingRecipe.isRecipeDiscovered(player, recipe.id)) {
				await PlayerCookingRecipe.discoverRecipe(player, recipe.id, bossMapId);
				return recipe;
			}
		}
		return null;
	}

	/**
	 * Discover a WITCH recipe matching a specific potion nature.
	 * Used when the witch brew succeeds — the discovered recipe matches the ingredient used.
	 */
	static async discoverWitchRecipe(player: Player, potionNature: ItemNature): Promise<CookingRecipe | null> {
		const recipeType = POTION_NATURE_TO_RECIPE_TYPE[potionNature];

		const candidates = recipeRegistry.getAll()
			.filter(r => !r.discoveredByDefault
				&& r.discoverySource === RecipeDiscoverySource.WITCH
				&& (recipeType ? r.recipeType === recipeType : true))
			.sort((a, b) => a.level - b.level);

		for (const recipe of candidates) {
			if (!await PlayerCookingRecipe.isRecipeDiscovered(player, recipe.id)) {
				await PlayerCookingRecipe.discoverRecipe(player, recipe.id);
				return recipe;
			}
		}

		// If no match for this nature, try any WITCH recipe
		return RecipeDiscoveryService.discoverFromSource(player, RecipeDiscoverySource.WITCH);
	}

	/**
	 * Discover all COOKING_LEVEL recipes up to the player's current cooking level.
	 * Returns all newly discovered recipes.
	 */
	static async discoverCookingLevelRecipes(player: Player): Promise<CookingRecipe[]> {
		const discovered: CookingRecipe[] = [];
		const candidates = recipeRegistry.getAll()
			.filter(r => !r.discoveredByDefault
				&& r.discoverySource === RecipeDiscoverySource.COOKING_LEVEL
				&& r.level <= player.cookingLevel)
			.sort((a, b) => a.level - b.level);

		for (const recipe of candidates) {
			if (!await PlayerCookingRecipe.isRecipeDiscovered(player, recipe.id)) {
				await PlayerCookingRecipe.discoverRecipe(player, recipe.id);
				discovered.push(recipe);
			}
		}
		return discovered;
	}
}
