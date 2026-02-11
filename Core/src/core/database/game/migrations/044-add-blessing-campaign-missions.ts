import { QueryInterface } from "sequelize";
import {
	addCampaignMissionList, removeCampaignMissionList
} from "../GameDatabaseUtils";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	/*
	 * Add blessing-related campaign missions
	 * Positions are in the ORIGINAL campaign (106 missions before this migration)
	 * The function sorts positions in descending order and inserts one by one
	 * IMPORTANT: When inserting multiple missions consecutively, use the SAME position
	 * for both since the algorithm processes in descending order
	 *
	 * Final positions after migration:
	 * - meetOracle: position 47 (after meetTalvar)
	 * - contributeToBlessing (100): position 48 (after meetOracle)
	 * - contributeToBlessing (6500): position 61 (after meetSirRowan)
	 * - contributeToBlessing (16300): position 87 (after reachGlory)
	 * - meetAllOracles: position 99 (after meetHermit)
	 */
	await addCampaignMissionList(context, [
		47, // meetOracle (after meetTalvar)
		47, // contributeToBlessing 100 (after meetOracle) - same position for consecutive
		59, // contributeToBlessing 6500 (after meetSirRowan)
		84, // contributeToBlessing 16300 (after reachGlory)
		95 // meetAllOracles (after meetHermit)
	]);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMissionList(context, [
		47,
		47,
		59,
		84,
		95
	]);
}
