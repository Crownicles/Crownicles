import {
	CAMPAIGN_RECIPE_MILESTONES, PLAYER_LEVEL_RECIPE_MILESTONES, RecipeDiscoverySource, RecipeType
} from "../../../../Lib/src/constants/CookingConstants";
import { CookingRecipeDataController } from "../../data/CookingRecipeData";
import PlayerCookingRecipe from "../database/game/models/PlayerCookingRecipe";
import Player from "../database/game/models/Player";
import { CookingRecipe } from "../../../../Lib/src/types/CookingRecipe";
import { ItemNature } from "../../../../Lib/src/constants/ItemConstants";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";

export interface RecipeDiscoveryOffer {
	recipe: CookingRecipe;
	cost: number;
}

export interface ProgressionRecipeUnlock {
	recipeId: string;
	requiredProgress: number;
}

/**
 * Sources whose recipes are granted by a progression counter (player level, campaign
 * missions completed) instead of a one-off event: the n-th recipe of the source, recipes
 * being ordered by level, is unlocked once the n-th milestone is reached. Ordering by
 * progression instead of counting events makes the grant idempotent and self-healing —
 * a player who advanced before the feature existed catches up on their next progression.
 */
const PROGRESSION_RECIPE_MILESTONES = {
	[RecipeDiscoverySource.PLAYER_LEVEL_MILESTONE]: PLAYER_LEVEL_RECIPE_MILESTONES,
	[RecipeDiscoverySource.CAMPAIGN_MILESTONE]: CAMPAIGN_RECIPE_MILESTONES
} as const;

export type ProgressionRecipeSource = keyof typeof PROGRESSION_RECIPE_MILESTONES;

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
	 * Get sorted candidates for a given filter predicate. The id is used as a tie-breaker so
	 * the discovery order never depends on the order the recipe files happen to be read in.
	 */
	private static getSortedCandidates(filter: (r: CookingRecipe) => boolean): CookingRecipe[] {
		return CookingRecipeDataController.instance.getAll()
			.filter(filter)
			.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
	}

	/**
	 * Discover every given recipe the player does not know yet, and return the newly discovered ids.
	 */
	private static async discoverRecipeIds(player: Player, recipeIds: string[]): Promise<string[]> {
		const discovered: string[] = [];
		for (const recipeId of recipeIds) {
			if (!await PlayerCookingRecipe.isRecipeDiscovered(player, recipeId)) {
				await PlayerCookingRecipe.discoverRecipe(player, recipeId);
				discovered.push(recipeId);
			}
		}
		return discovered;
	}

	/**
	 * Get every recipe of a progression source paired with the progression value unlocking it.
	 * Shared with the retroactive migration so both use the exact same ordering.
	 */
	static getProgressionUnlocks(source: ProgressionRecipeSource): ProgressionRecipeUnlock[] {
		const milestones = PROGRESSION_RECIPE_MILESTONES[source];
		return RecipeDiscoveryService.getSortedCandidates(
			r => !r.discoveredByDefault && r.discoverySource === source
		)
			.slice(0, milestones.length)
			.map((recipe, index) => ({
				recipeId: recipe.id,
				requiredProgress: milestones[index]
			}));
	}

	/**
	 * Grant every recipe the player's current progression entitles them to and return the newly
	 * learned ones. Safe to call repeatedly: already known recipes are skipped.
	 */
	static async syncProgressionRecipes(player: Player, source: ProgressionRecipeSource, progress: number): Promise<string[]> {
		const entitledRecipeIds = RecipeDiscoveryService.getProgressionUnlocks(source)
			.filter(unlock => progress >= unlock.requiredProgress)
			.map(unlock => unlock.recipeId);
		return await RecipeDiscoveryService.discoverRecipeIds(player, entitledRecipeIds);
	}

	/**
	 * Count how many recipes from a given source the player has already discovered
	 */
	static async countDiscoveredFromSource(player: Player, source: RecipeDiscoverySource): Promise<number> {
		const sourceRecipeIds = CookingRecipeDataController.instance.getAll()
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
	 * Returns the ids of all newly discovered recipes.
	 */
	static discoverCookingLevelRecipes(player: Player): Promise<string[]> {
		const candidates = RecipeDiscoveryService.getSortedCandidates(
			r => !r.discoveredByDefault
				&& r.discoverySource === RecipeDiscoverySource.COOKING_LEVEL
				&& r.level <= player.cookingLevel
		);
		return RecipeDiscoveryService.discoverRecipeIds(player, candidates.map(recipe => recipe.id));
	}

	/**
	 * Peek the next recipe that would be discovered from a source and its cost,
	 * without discovering it or charging the player.
	 * Returns null if no undiscovered recipe is available for that source.
	 */
	static async peekNextDiscovery(player: Player, source: RecipeDiscoverySource, costs: readonly number[]): Promise<RecipeDiscoveryOffer | null> {
		const candidates = RecipeDiscoveryService.getSortedCandidates(
			r => !r.discoveredByDefault && r.discoverySource === source
		);
		for (const recipe of candidates) {
			if (!await PlayerCookingRecipe.isRecipeDiscovered(player, recipe.id)) {
				const alreadyDiscovered = await RecipeDiscoveryService.countDiscoveredFromSource(player, source);
				return {
					recipe,
					cost: costs[Math.min(alreadyDiscovered, costs.length - 1)]
				};
			}
		}
		return null;
	}

	/**
	 * Discover a specific recipe and charge the player for it.
	 * Re-validates that the recipe is still undiscovered and affordable.
	 * Returns true if the purchase succeeded.
	 */
	static async discoverAndPay(params: {
		player: Player;
		recipeId: string;
		cost: number;
		response: CrowniclesPacket[];
	}): Promise<boolean> {
		if (params.player.money < params.cost || await PlayerCookingRecipe.isRecipeDiscovered(params.player, params.recipeId)) {
			return false;
		}
		await PlayerCookingRecipe.discoverRecipe(params.player, params.recipeId);
		await params.player.spendMoney({
			amount: params.cost,
			response: params.response,
			reason: NumberChangeReason.SMALL_EVENT
		});
		await params.player.save();
		return true;
	}
}
