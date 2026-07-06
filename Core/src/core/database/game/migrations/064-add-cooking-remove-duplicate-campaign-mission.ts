import { QueryInterface } from "sequelize";
import {
	addCampaignMission, removeCampaignMission
} from "../GameDatabaseUtils";

/*
 * Campaign tweaks from the V6 test feedback (#4347):
 * - Add a cooking campaign mission (cookRecipes) at final position 60.
 * - Remove the duplicated meetDifferentPlayers mission (originally at position 100,
 *   already present at position 73).
 *
 * The campaign keeps 144 missions (one added, one removed).
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Insert the cooking mission at position 60 (shifts every later mission by +1).
	await addCampaignMission(context, 60);

	// The old position-100 duplicate is now at position 101 after the insert above.
	await removeCampaignMission(context, 101);

	/*
	 * Players who already completed the campaign (campaignProgression = 0) are pointed
	 * to the newly inserted cooking mission (position 60) so they receive the new content.
	 */
	await context.sequelize.query(`
		UPDATE player_missions_info
		SET campaignProgression = 60
		WHERE campaignProgression = 0
		  AND LENGTH(campaignBlob) > 0
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	// Reverse in the opposite order: re-add the removed mission, then drop the cooking one.
	await addCampaignMission(context, 101);
	await removeCampaignMission(context, 60);
}
