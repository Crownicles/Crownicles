import { QueryInterface } from "sequelize";
import {
	addCampaignMission, removeCampaignMission
} from "../GameDatabaseUtils";

/*
 * Campaign tweak from the V6 test feedback (#4347):
 * The "upgrade a weapon or shield" mission arrived too early (before the player had
 * explored expeditions/islands and gathered good gear). Move it from position 23 to
 * position 41, right after the "join the PvE island" milestone.
 *
 * A move is expressed as remove-at-old-position followed by add-at-new-position.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMission(context, 23);
	await addCampaignMission(context, 41);

	// Completed-campaign players are pointed to the relocated mission (position 41).
	await context.sequelize.query(`
		UPDATE player_missions_info
		SET campaignProgression = 41
		WHERE campaignProgression = 0
		  AND LENGTH(campaignBlob) > 0
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	// Reverse: remove from the new position, re-add at the old one.
	await removeCampaignMission(context, 41);
	await addCampaignMission(context, 23);
}
