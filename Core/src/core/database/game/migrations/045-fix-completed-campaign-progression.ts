import { QueryInterface } from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	/*
	 * Fix campaignProgression for players who completed the campaign before migration 044
	 * The UPDATE was missing in the original migration 044 deployment
	 * Players with campaignProgression = 0 (campaign completed) need to have their progression
	 * updated to point to the first new mission (position 10 = goToPlace Le Berceau)
	 */
	await context.sequelize.query(`
		UPDATE player_missions_info
		SET campaignProgression = 10
		WHERE campaignProgression = 0
		  AND LENGTH(campaignBlob) > 0
	`);
}

export async function down(): Promise<void> {
	// No rollback needed - this is a one-time fix
}
