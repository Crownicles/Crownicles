import { QueryInterface } from "sequelize";
import {
	addCampaignMission, removeCampaignMission
} from "../GameDatabaseUtils";

/*
 * Campaign rework from the V6 test feedback (#4347), applied as a single migration.
 *
 * The campaign grows from 144 to 146 missions. Each structural change is a blob edit:
 * addCampaignMission(pos) inserts an uncompleted "0" at pos (and shifts progression),
 * removeCampaignMission(pos) deletes the char at pos. A mission MOVE is therefore a
 * remove-at-old-position followed by an add-at-new-position; the moved mission's
 * completion is intentionally reset (it becomes a "0" at its new position).
 *
 * The operations below are applied in order; the positions are expressed in the blob
 * coordinate system AS IT EXISTS at each step (i.e. after the previous operations).
 * A blob simulation confirmed the final uncompleted positions match campaign.json:
 * [10, 12, 19, 20, 39, 41, 52, 62, 70, 119, 130].
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Cooking mission (position 60) + removal of the duplicated meetDifferentPlayers.
	await addCampaignMission(context, 60);
	await removeCampaignMission(context, 101);

	// New "use /map" mission before "travel to Le Berceau".
	await addCampaignMission(context, 10);

	// New "plant a seed" gardening mission before the PvE island milestone.
	await addCampaignMission(context, 40);

	// Move "upgrade a weapon or shield" after joining the PvE island.
	await removeCampaignMission(context, 23);
	await addCampaignMission(context, 41);

	// Move "get an ancestral tree sapling" later.
	await removeCampaignMission(context, 115);
	await addCampaignMission(context, 130);

	// Move "succeed at 25 expeditions" a few tiers later.
	await removeCampaignMission(context, 114);
	await addCampaignMission(context, 119);

	// Move the low-risk dangerous expedition mission earlier.
	await removeCampaignMission(context, 114);
	await addCampaignMission(context, 70);

	// Move "collect the rent" later so rent can accumulate.
	await removeCampaignMission(context, 46);
	await addCampaignMission(context, 52);

	// Move "visit the general shop" right after reaching Le Berceau.
	await removeCampaignMission(context, 17);
	await addCampaignMission(context, 12);

	// Move the home missions (buyHome, then depositChestItem) after "reach a score".
	await removeCampaignMission(context, 13);
	await addCampaignMission(context, 20);
	await removeCampaignMission(context, 13);
	await addCampaignMission(context, 20);

	// Completed-campaign players are pointed to the earliest new mission (position 10).
	await context.sequelize.query(`
		UPDATE player_missions_info
		SET campaignProgression = 10
		WHERE campaignProgression = 0
		  AND LENGTH(campaignBlob) > 0
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	// Reverse every operation of up() in the opposite order.
	await removeCampaignMission(context, 20);
	await addCampaignMission(context, 13);
	await removeCampaignMission(context, 20);
	await addCampaignMission(context, 13);

	await removeCampaignMission(context, 12);
	await addCampaignMission(context, 17);

	await removeCampaignMission(context, 52);
	await addCampaignMission(context, 46);

	await removeCampaignMission(context, 70);
	await addCampaignMission(context, 114);

	await removeCampaignMission(context, 119);
	await addCampaignMission(context, 114);

	await removeCampaignMission(context, 130);
	await addCampaignMission(context, 115);

	await removeCampaignMission(context, 41);
	await addCampaignMission(context, 23);

	await removeCampaignMission(context, 40);

	await removeCampaignMission(context, 10);

	await addCampaignMission(context, 101);
	await removeCampaignMission(context, 60);
}
