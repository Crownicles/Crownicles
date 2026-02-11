import { QueryInterface } from "sequelize";
import {
	addCampaignMissionList, removeCampaignMissionList
} from "../GameDatabaseUtils";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	/*
	 * Add new campaign missions (blessing + variations + fromPlaceToPlace)
	 * Positions are in the ORIGINAL campaign (106 missions before this migration)
	 * The function sorts positions in descending order and inserts one by one
	 * IMPORTANT: When inserting multiple missions consecutively, use the SAME position
	 * for both since the algorithm processes in descending order
	 *
	 * Final positions after migration (125 missions total):
	 * - goToPlace (Le Berceau): position 10
	 * - goToPlace (Boug-Coton): position 36
	 * - meetOracle: position 49
	 * - contributeToBlessing (100): position 50
	 * - buyTokensFromShop 5: position 52
	 * - goToPlace (Claire de Ville): position 58
	 * - contributeToBlessing (6500): position 65
	 * - doExpeditions 5: position 69
	 * - goToPlace (Forêt Célestrum): position 80
	 * - meetDifferentPlayers 5: position 87
	 * - contributeToBlessing (16300): position 94
	 * - doExpeditions 25: position 98
	 * - goToPlace (Ville Forte): position 103
	 * - fromPlaceToPlace (Chemin du Dédale -> Route Grimpante, 30h): position 108
	 * - meetAllOracles: position 109
	 * - earnXP 7000: position 110
	 * - buyTokensFromShop 10: position 116
	 * - spendMoney 25000: position 120
	 * - fromPlaceToPlace (Vallée des Rois -> Mont Célestrum, 3h): position 125
	 */
	await addCampaignMissionList(context, [
		10, // goToPlace (Le Berceau)
		35, // goToPlace (Boug-Coton)
		47, // meetOracle
		47, // contributeToBlessing 100 - same position for consecutive
		48, // buyTokensFromShop 5
		53, // goToPlace (Claire de Ville)
		59, // contributeToBlessing 6500
		62, // doExpeditions 5
		72, // goToPlace (Forêt Célestrum)
		78, // meetDifferentPlayers 5
		84, // contributeToBlessing 16300
		87, // doExpeditions 25
		91, // goToPlace (Ville Forte)
		95, // fromPlaceToPlace (5->24, 30h) - same position for consecutive trio
		95, // meetAllOracles
		95, // earnXP 7000
		100, // buyTokensFromShop 10
		103, // spendMoney 25000
		107 // fromPlaceToPlace (1->23, 3h) - final mission
	]);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMissionList(context, [
		10,
		35,
		47,
		47,
		48,
		53,
		59,
		62,
		72,
		78,
		84,
		87,
		91,
		95,
		95,
		95,
		100,
		103,
		107
	]);
}
