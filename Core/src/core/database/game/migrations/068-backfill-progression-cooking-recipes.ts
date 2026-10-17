import { QueryInterface } from "sequelize";
import { RecipeDiscoveryService } from "../../../cooking/RecipeDiscoveryService";
import { RecipeDiscoverySource } from "../../../../../../Lib/src/constants/CookingConstants";

/**
 * Progression-based cooking recipes used to be granted one per event (one per level up, one
 * per completed campaign mission) starting the day the feature shipped. Players who had
 * already progressed never received them, and a player who finished the campaign could never
 * get its recipes at all. Recipes are now tied to progression milestones, so backfill every
 * recipe the players are already entitled to.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	for (const unlock of RecipeDiscoveryService.getProgressionUnlocks(RecipeDiscoverySource.PLAYER_LEVEL_MILESTONE)) {
		await context.sequelize.query(`
			INSERT IGNORE INTO player_cooking_recipes (playerId, recipeId, sourceMapId)
			SELECT p.id, :recipeId, NULL
			FROM players p
			WHERE p.level >= :requiredProgress
		`, {
			replacements: {
				recipeId: unlock.recipe.id,
				requiredProgress: unlock.requiredProgress
			}
		});
	}

	for (const unlock of RecipeDiscoveryService.getProgressionUnlocks(RecipeDiscoverySource.CAMPAIGN_MILESTONE)) {
		await context.sequelize.query(`
			INSERT IGNORE INTO player_cooking_recipes (playerId, recipeId, sourceMapId)
			SELECT pmi.playerId, :recipeId, NULL
			FROM player_missions_info pmi
			WHERE LENGTH(pmi.campaignBlob) - LENGTH(REPLACE(pmi.campaignBlob, '1', '')) >= :requiredProgress
		`, {
			replacements: {
				recipeId: unlock.recipe.id,
				requiredProgress: unlock.requiredProgress
			}
		});
	}
}

export async function down(): Promise<void> {
	// No rollback: revoking learned recipes would be worse than keeping them.
}
