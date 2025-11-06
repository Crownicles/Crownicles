import { QueryInterface } from "sequelize";
import {
	addCampaignMissionList, removeCampaignMissionList
} from "../GameDatabaseUtils";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await addCampaignMissionList(context, [
		11,
		23,
		26,
		26,
		33,
		38,
		43,
		48,
		51,
		54,
		54,
		67,
		71,
		72,
		77,
		77,
		77,
		77,
		77,
		77
	]);

	/*
	 * Fix campaignProgression for players who completed the campaign before this migration
	 * Players with campaignProgression = 0 (campaign completed) need to have their progression
	 * updated to point to the first new mission (position 11)
	 */
	await context.sequelize.query(`
		UPDATE player_missions_info
		SET campaignProgression = 11
		WHERE campaignProgression = 0
		  AND LENGTH(campaignBlob) > 0
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMissionList(context, [
		11,
		23,
		26,
		26,
		33,
		38,
		43,
		48,
		51,
		54,
		54,
		67,
		71,
		72,
		77,
		77,
		77,
		77,
		77,
		77
	]);
}
