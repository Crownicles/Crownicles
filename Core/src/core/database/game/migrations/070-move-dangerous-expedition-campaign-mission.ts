import { QueryInterface } from "sequelize";
import {
	addCampaignMission, removeCampaignMission
} from "../GameDatabaseUtils";

/*
 * Campaign tweak from the V6 test feedback (#4347):
 * The lower-risk dangerous expedition mission was too easy for its late position.
 * Move it earlier, from position 114 to position 70, where it fits the difficulty curve.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMission(context, 114);
	await addCampaignMission(context, 70);

	// Completed-campaign players are pointed to the relocated mission (position 70).
	await context.sequelize.query(`
		UPDATE player_missions_info
		SET campaignProgression = 70
		WHERE campaignProgression = 0
		  AND LENGTH(campaignBlob) > 0
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMission(context, 70);
	await addCampaignMission(context, 114);
}
