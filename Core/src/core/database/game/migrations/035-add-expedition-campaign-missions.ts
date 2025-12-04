import { QueryInterface } from "sequelize";
import {
	addCampaignMissionList, removeCampaignMissionList
} from "../GameDatabaseUtils";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Add expedition missions to the campaign
	// Positions are in the ORIGINAL campaign (97 missions before this migration)
	// The function sorts positions in descending order and inserts one by one
	await addCampaignMissionList(context, [
		40, // doExpeditions (after trainedPet)
		76, // longExpedition 120min (after fightStreak)
		83, // longExpedition 300min (after drinkEnergyPotion)
		83, // dangerousExpedition 30% (after longExpedition 300min)
		89, // expeditionStreak (after meetHermit)
		95, // dangerousExpedition 50% (after sellItemWithGivenCost)
		98  // showCloneToTalvar (at the very end)
	]);

	// Handle players who have already completed the campaign
	// They need to be set to the first new mission (position 40 -> doExpeditions)
	await context.sequelize.query(`
		UPDATE player_missions_info
		SET campaignProgression = 40
		WHERE campaignProgression = 0
		  AND LENGTH(campaignBlob) > 0
	`);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMissionList(context, [
		40,
		76,
		83,
		83,
		89,
		95,
		98
	]);
}
