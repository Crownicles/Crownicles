import { QueryInterface } from "sequelize";
import {
	addCampaignMission, removeCampaignMission
} from "../GameDatabaseUtils";

/*
 * Campaign tweak from the V6 test feedback (#4347):
 * "Collect the rent of an apartment" sat right after buying it, before any rent could
 * accumulate. Move it a bit later, from position 46 to position 52.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMission(context, 46);
	await addCampaignMission(context, 52);

	// Completed-campaign players are pointed to the relocated mission (position 52).
	await context.sequelize.query(`
		UPDATE player_missions_info
		SET campaignProgression = 52
		WHERE campaignProgression = 0
		  AND LENGTH(campaignBlob) > 0
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMission(context, 52);
	await addCampaignMission(context, 46);
}
