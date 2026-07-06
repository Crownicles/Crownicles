import { QueryInterface } from "sequelize";
import {
	addCampaignMission, removeCampaignMission
} from "../GameDatabaseUtils";

/*
 * Campaign tweak from the V6 test feedback (#4347):
 * Add a "use the /map command" campaign mission (commandMap) at final position 10,
 * right before the "travel to Le Berceau" mission, so players discover the map early.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await addCampaignMission(context, 10);

	// Players who already completed the campaign are pointed to the new mission (position 10).
	await context.sequelize.query(`
		UPDATE player_missions_info
		SET campaignProgression = 10
		WHERE campaignProgression = 0
		  AND LENGTH(campaignBlob) > 0
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMission(context, 10);
}
