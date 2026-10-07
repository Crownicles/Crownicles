import { QueryInterface } from "sequelize";

const CAMPAIGN_POSITION = 2;
const PREVIOUS_MISSION_ID = "commandReport";
const NEXT_MISSION_ID = "spendTokens";

async function replaceActiveMission(context: QueryInterface, previousMissionId: string, nextMissionId: string): Promise<void> {
	await context.sequelize.query(`
		UPDATE mission_slots ms
		JOIN player_missions_info pmi ON pmi.playerId = ms.playerId
		SET ms.missionId = :nextMissionId,
		    ms.numberDone = 0,
		    ms.saveBlob = NULL
		WHERE ms.expiresAt IS NULL
		  AND pmi.campaignProgression = :position
		  AND ms.missionId = :previousMissionId
		  AND ms.missionVariant = 0
		  AND ms.missionObjective = 1
	`, {
		replacements: {
			previousMissionId,
			nextMissionId,
			position: CAMPAIGN_POSITION
		}
	});
}

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await replaceActiveMission(context, PREVIOUS_MISSION_ID, NEXT_MISSION_ID);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await replaceActiveMission(context, NEXT_MISSION_ID, PREVIOUS_MISSION_ID);
}
