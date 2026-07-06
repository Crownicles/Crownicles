import { QueryInterface } from "sequelize";
import {
	addCampaignMission, removeCampaignMission
} from "../GameDatabaseUtils";

/*
 * Campaign tweak from the V6 test feedback (#4347):
 * Add an early gardening campaign mission (plantSeed) at final position 40, before
 * the PvE island milestone, so players are introduced to the garden before the
 * later, rarer plant missions.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await addCampaignMission(context, 40);

	// Players who already completed the campaign are pointed to the new mission (position 40).
	await context.sequelize.query(`
		UPDATE player_missions_info
		SET campaignProgression = 40
		WHERE campaignProgression = 0
		  AND LENGTH(campaignBlob) > 0
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMission(context, 40);
}
