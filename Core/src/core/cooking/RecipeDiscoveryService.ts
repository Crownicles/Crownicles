import {
	RecipeDiscoverySource, RecipeType
} from "../../../../Lib/src/constants/CookingConstants";
import { recipeRegistry } from "./RecipeRegistry";
import PlayerCookingRecipe from "../database/game/models/PlayerCookingRecipe";
import Player from "../database/game/models/Player";
import { CookingRecipe } from "../../../../Lib/src/types/CookingRecipe";
import { ItemNature } from "../../../../Lib/src/constants/ItemConstants";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";

export interface RecipeDiscoveryPayResult {
	discoveredRecipeId?: string;
	recipeCost?: number;
}

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
	 * Find and discover the first undiscovered recipe from a sorted list of candidates.
	 * Returns the discovered recipe or null if all candidates are already known.
	 */
	private static async discoverFirstUndiscovered(player: Player, candidates: CookingRecipe[], sourceMapId?: number): Promise<CookingRecipe | null> {
		for (const recipe of candidates) {
			if (!await PlayerCookingRecipe.isRecipeDiscovered(player, recipe.id)) {
				await PlayerCookingRecipe.discoverRecipe(player, recipe.id, sourceMapId);
				return recipe;
			}
		}
		return null;
	}

	/**
	 * Get sorted candidates for a given filter predicate
	 */
	private static getSortedCandidates(filter: (r: CookingRecipe) => boolean): CookingRecipe[] {
		return recipeRegistry.getAll()
			.filter(filter)
			.sort((a, b) => a.level - b.level);
	}

	/**
	 * Count how many recipes from a given source the player has already discovered
	 */
	static async countDiscoveredFromSource(player: Player, source: RecipeDiscoverySource): Promise<number> {
		const sourceRecipeIds = recipeRegistry.getAll()
			.filter(r => !r.discoveredByDefault && r.discoverySource === source)
			.map(r => r.id);
		const discoveredIds = await PlayerCookingRecipe.getDiscoveredRecipeIds(player);
		return sourceRecipeIds.filter(id => discoveredIds.includes(id)).length;
	}

	/**
	 * Discover a recipe from a given source for a player.
	 * Picks the lowest-level undiscovered recipe matching the source.
	 * Returns the discovered recipe or null if none available.
	 */
	static discoverFromSource(player: Player, source: RecipeDiscoverySource): Promise<CookingRecipe | null> {
		const candidates = RecipeDiscoveryService.getSortedCandidates(
			r => !r.discoveredByDefault && r.discoverySource === source
		);
		return RecipeDiscoveryService.discoverFirstUndiscovered(player, candidates);
	}

	/**
	 * Discover a recipe from an island boss defeat.
	 * Each unique boss (by mapId) can only grant one recipe per player.
	 */
	static async discoverFromBoss(player: Player, bossMapId: number): Promise<CookingRecipe | null> {
		if (await PlayerCookingRecipe.hasDiscoveredFromMapId(player, bossMapId)) {
			return null;
		}

		const candidates = RecipeDiscoveryService.getSortedCandidates(
			r => !r.discoveredByDefault && r.discoverySource === RecipeDiscoverySource.ISLAND_BOSS
		);
		return RecipeDiscoveryService.discoverFirstUndiscovered(player, candidates, bossMapId);
	}

	/**
	 * Discover a WITCH recipe matching a specific potion nature.
	 * Used when the witch brew succeeds — the discovered recipe matches the ingredient used.
	 */
	static async discoverWitchRecipe(player: Player, potionNature: ItemNature): Promise<CookingRecipe | null> {
		const recipeType = POTION_NATURE_TO_RECIPE_TYPE[potionNature];

		const candidates = RecipeDiscoveryService.getSortedCandidates(
			r => !r.discoveredByDefault
				&& r.discoverySource === RecipeDiscoverySource.WITCH
				&& (recipeType ? r.recipeType === recipeType : true)
		);

		const discovered = await RecipeDiscoveryService.discoverFirstUndiscovered(player, candidates);
		if (discovered) {
			return discovered;
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
		const candidates = RecipeDiscoveryService.getSortedCandidates(
			r => !r.discoveredByDefault
				&& r.discoverySource === RecipeDiscoverySource.COOKING_LEVEL
				&& r.level <= player.cookingLevel
		);

		for (const recipe of candidates) {
			if (!await PlayerCookingRecipe.isRecipeDiscovered(player, recipe.id)) {
				await PlayerCookingRecipe.discoverRecipe(player, recipe.id);
				discovered.push(recipe);
			}
		}
		return discovered;
	}

	/**
	 * Try to discover a recipe from a source and pay for it.
	 * Returns the discovered recipe id and cost if successful.
	 */
	static async tryDiscoverAndPay(params: {
		player: Player;
		source: RecipeDiscoverySource;
		costs: readonly number[];
		response: CrowniclesPacket[];
	}): Promise<RecipeDiscoveryPayResult> {
		const alreadyDiscovered = await RecipeDiscoveryService.countDiscoveredFromSource(params.player, params.source);
		const cost = params.costs[Math.min(alreadyDiscovered, params.costs.length - 1)];
		if (params.player.money >= cost) {
			const discovered = await RecipeDiscoveryService.discoverFromSource(params.player, params.source);
			if (discovered) {
				await params.player.spendMoney({
					amount: cost,
					response: params.response,
					reason: NumberChangeReason.SMALL_EVENT
				});
				await params.player.save();
				return {
					discoveredRecipeId: discovered.id,
					recipeCost: cost
				};
			}
		}
		return {};
	}
}
