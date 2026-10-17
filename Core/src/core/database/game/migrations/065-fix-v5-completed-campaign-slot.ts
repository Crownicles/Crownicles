import { QueryInterface } from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	/*
	 * Completed V5 players kept their finished depositPetInShelter MissionSlot
	 * when migrations 063 and 064 reopened the campaign. Their blob points to
	 * commandMap at position 10, while campaignProgression and the slot remained
	 * out of sync at position 12.
	 */
	await context.sequelize.query(`
		UPDATE player_missions_info pmi
		JOIN mission_slots ms ON ms.playerId = pmi.playerId
		SET pmi.campaignProgression = 10,
		    ms.missionId = 'commandMap',
		    ms.missionVariant = 0,
		    ms.missionObjective = 1,
		    ms.numberDone = 0,
		    ms.gemsToWin = 1,
		    ms.xpToWin = 40,
		    ms.moneyToWin = 0,
		    ms.saveBlob = NULL
		WHERE pmi.campaignProgression = 12
		  AND LENGTH(pmi.campaignBlob) = 149
		  AND SUBSTRING(pmi.campaignBlob, 10, 3) = '010'
		  AND ms.expiresAt IS NULL
		  AND ms.missionId = 'depositPetInShelter'
		  AND ms.missionObjective = 1
		  AND ms.numberDone = 1
	`);
}

export async function down(): Promise<void> {
	// No rollback: restoring the stale completed slot would recreate the bug.
}
