import { QueryInterface } from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	/*
	 * Fix the campaign MissionSlot for players who completed the campaign before migration 044
	 * Migration 045 already set campaignProgression = 10, but the MissionSlot still has the old mission
	 *
	 * Update the campaign MissionSlot (where expiresAt is NULL) for players whose
	 * campaignProgression is 10 and still have the old showCloneToTalvar mission
	 *
	 * Mission at position 10: goToPlace variant 3, objective 1, 2 gems, 100 xp
	 */
	await context.sequelize.query(`
		UPDATE mission_slots ms
		JOIN player_missions_info pmi ON ms.playerId = pmi.playerId
		SET ms.missionId = 'goToPlace',
		    ms.missionVariant = 3,
		    ms.missionObjective = 1,
		    ms.numberDone = 0,
		    ms.gemsToWin = 2,
		    ms.xpToWin = 100,
		    ms.moneyToWin = 0,
		    ms.saveBlob = NULL
		WHERE ms.expiresAt IS NULL
		  AND pmi.campaignProgression = 10
		  AND ms.missionId = 'showCloneToTalvar'
	`);
}

export async function down(): Promise<void> {
	// No rollback needed - this is a one-time fix
}
