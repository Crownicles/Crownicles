import { QueryInterface } from "sequelize";
import {
	addCampaignMissionList, removeCampaignMissionList
} from "../GameDatabaseUtils";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	/*
	 * Add new campaign missions
	 * Positions are in the ORIGINAL campaign (96 missions before this migration)
	 * The function sorts positions in descending order and inserts one by one
	 * IMPORTANT: When inserting multiple missions consecutively, use the SAME position
	 * for both since the algorithm processes in descending order
	 */
	await addCampaignMissionList(context, [
		26, // meetVelanna (after chooseClassTier with variant 1)
		39, // doExpeditions (after trainedPet)
		39, // buyTokensFromShop (after doExpeditions) - same position as doExpeditions
		75, // longExpedition 120min (after fightStreak)
		82, // longExpedition 300min (after drinkEnergyPotion)
		82, // dangerousExpedition 30% (after longExpedition 300min)
		89, // expeditionStreak (after meetHermit)
		89, // maxTokensReached (after expeditionStreak) - same position as expeditionStreak
		94, // dangerousExpedition 50% (after sellItemWithGivenCost)
		97 // showCloneToTalvar (at the very end)
	]);

	/*
	 * Handle players who have already completed the campaign
	 * They need to be set to the first new mission (position 26 -> meetVelanna)
	 */
	await context.sequelize.query(`
		UPDATE player_missions_info
		SET campaignProgression = 26
		WHERE campaignProgression = 0
		  AND LENGTH(campaignBlob) > 0
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMissionList(context, [
		26,
		39,
		39,
		75,
		82,
		82,
		89,
		89,
		94,
		97
	]);
}
