import { QueryInterface } from "sequelize";
import {
	addCampaignMission, removeCampaignMission
} from "../GameDatabaseUtils";

/*
 * Campaign tweak from the V6 test feedback (#4347):
 * The "get an ancestral tree sapling" mission asked for the rarest plant too early,
 * with no intermediate gardening steps. Move it from position 115 to position 130.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMission(context, 115);
	await addCampaignMission(context, 130);

	// Completed-campaign players are pointed to the relocated mission (position 130).
	await context.sequelize.query(`
		UPDATE player_missions_info
		SET campaignProgression = 130
		WHERE campaignProgression = 0
		  AND LENGTH(campaignBlob) > 0
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMission(context, 130);
	await addCampaignMission(context, 115);
}
