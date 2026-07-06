import { QueryInterface } from "sequelize";
import {
	addCampaignMission, removeCampaignMission
} from "../GameDatabaseUtils";

/*
 * Campaign tweak from the V6 test feedback (#4347):
 * The "visit the general shop" mission appeared too late. Move it earlier, from
 * position 17 to position 12, right after the "travel to Le Berceau" mission so
 * players discover the city shop as soon as they reach a city.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMission(context, 17);
	await addCampaignMission(context, 12);

	// Completed-campaign players are pointed to the relocated mission (position 12).
	await context.sequelize.query(`
		UPDATE player_missions_info
		SET campaignProgression = 12
		WHERE campaignProgression = 0
		  AND LENGTH(campaignBlob) > 0
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMission(context, 12);
	await addCampaignMission(context, 17);
}
