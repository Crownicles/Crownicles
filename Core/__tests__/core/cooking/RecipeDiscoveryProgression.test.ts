import {
	describe, expect, it
} from "vitest";
import { RecipeDiscoveryService } from "../../../src/core/cooking/RecipeDiscoveryService";
import {
	CAMPAIGN_RECIPE_MILESTONES, PLAYER_LEVEL_RECIPE_MILESTONES, RecipeDiscoverySource
} from "../../../../Lib/src/constants/CookingConstants";
import { CookingRecipeDataController } from "../../../src/data/CookingRecipeData";

const PROGRESSION_SOURCES = [
	{
		source: RecipeDiscoverySource.PLAYER_LEVEL_MILESTONE,
		milestones: PLAYER_LEVEL_RECIPE_MILESTONES
	},
	{
		source: RecipeDiscoverySource.CAMPAIGN_MILESTONE,
		milestones: CAMPAIGN_RECIPE_MILESTONES
	}
] as const;

describe("RecipeDiscoveryService progression unlocks", () => {
	it.each(PROGRESSION_SOURCES)("should define exactly one milestone per $source recipe", ({
		source, milestones
	}) => {
		const sourceRecipes = CookingRecipeDataController.instance.getAll()
			.filter(recipe => !recipe.discoveredByDefault && recipe.discoverySource === source);

		expect(milestones).toHaveLength(sourceRecipes.length);
		expect(RecipeDiscoveryService.getProgressionUnlocks(source)).toHaveLength(sourceRecipes.length);
	});

	it.each(PROGRESSION_SOURCES)("should order $source unlocks by increasing recipe level and progression", ({
		source, milestones
	}) => {
		const unlocks = RecipeDiscoveryService.getProgressionUnlocks(source);
		const levels = unlocks.map(unlock => unlock.recipe.level);

		expect(unlocks.map(unlock => unlock.requiredProgress)).toEqual([...milestones]);
		expect(levels).toEqual([...levels].sort((a, b) => a - b));
	});

	it("should be stable across calls so the retroactive backfill matches the runtime order", () => {
		expect(RecipeDiscoveryService.getProgressionUnlocks(RecipeDiscoverySource.CAMPAIGN_MILESTONE))
			.toEqual(RecipeDiscoveryService.getProgressionUnlocks(RecipeDiscoverySource.CAMPAIGN_MILESTONE));
	});
});
