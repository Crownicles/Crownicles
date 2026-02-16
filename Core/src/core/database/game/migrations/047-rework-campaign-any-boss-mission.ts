import { QueryInterface } from "sequelize";
import {
	addCampaignMissionList, removeCampaignMissionList
} from "../GameDatabaseUtils";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	/*
	 * Rework campaign mission 67: replace winBossWithDifferentClasses (final bosses only)
	 * with winAnyBossWithDifferentClasses (any boss counts) for players currently on that mission
	 */
	await context.sequelize.query(`
		UPDATE mission_slots
		SET missionId = 'winAnyBossWithDifferentClasses'
		WHERE missionId = 'winBossWithDifferentClasses'
		  AND missionObjective = 2
		  AND expiresAt IS NULL
	`);

	// Add new campaign mission at position 99 (win any boss with 1 class)
	await addCampaignMissionList(context, [99]);

	// Set completed campaign players to the new mission position
	await context.sequelize.query(`
		UPDATE player_missions_info
		SET campaignProgression = 99
		WHERE campaignProgression = 0
		  AND LENGTH(campaignBlob) > 0
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.sequelize.query(`
		UPDATE mission_slots
		SET missionId = 'winBossWithDifferentClasses'
		WHERE missionId = 'winAnyBossWithDifferentClasses'
		  AND missionObjective = 2
		  AND expiresAt IS NULL
	`);

	await removeCampaignMissionList(context, [99]);
}
