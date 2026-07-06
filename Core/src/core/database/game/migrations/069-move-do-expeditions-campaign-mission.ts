import { QueryInterface } from "sequelize";
import {
	addCampaignMission, removeCampaignMission
} from "../GameDatabaseUtils";

/*
 * Campaign tweak from the V6 test feedback (#4347):
 * The "succeed at 25 expeditions" mission sat too close to other expedition missions.
 * Move it a few tiers later, from position 114 to position 119.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMission(context, 114);
	await addCampaignMission(context, 119);

	// Completed-campaign players are pointed to the relocated mission (position 119).
	await context.sequelize.query(`
		UPDATE player_missions_info
		SET campaignProgression = 119
		WHERE campaignProgression = 0
		  AND LENGTH(campaignBlob) > 0
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMission(context, 119);
	await addCampaignMission(context, 114);
}
