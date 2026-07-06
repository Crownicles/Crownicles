import { QueryInterface } from "sequelize";
import {
	addCampaignMission, removeCampaignMission
} from "../GameDatabaseUtils";

/*
 * Campaign tweak from the V6 test feedback (#4347):
 * The home missions (buy a home, then deposit an item in its chest) arrived too early,
 * before the player had explored the map and chosen where to settle. Move both, keeping
 * their order, to right after the "reach a score" mission (final positions 19 and 20).
 *
 * Each move is a remove-at-old followed by an add-at-new. buyHome starts at position 13
 * and depositChestItem right after it; once buyHome is pulled out, depositChestItem
 * shifts down to position 13 as well, hence the repeated (13 -> 20) pair.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Move buyHome (position 13) to position 20 (right after reachScore).
	await removeCampaignMission(context, 13);
	await addCampaignMission(context, 20);

	// Move depositChestItem (now at position 13) to position 20 (right after buyHome).
	await removeCampaignMission(context, 13);
	await addCampaignMission(context, 20);

	// Completed-campaign players are pointed to the first relocated mission (position 19).
	await context.sequelize.query(`
		UPDATE player_missions_info
		SET campaignProgression = 19
		WHERE campaignProgression = 0
		  AND LENGTH(campaignBlob) > 0
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	// Reverse the two moves in the opposite order.
	await removeCampaignMission(context, 20);
	await addCampaignMission(context, 13);
	await removeCampaignMission(context, 20);
	await addCampaignMission(context, 13);
}
