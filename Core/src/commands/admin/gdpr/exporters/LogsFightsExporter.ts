import { GDPRAnonymizer } from "../GDPRAnonymizer";
import {
	fetchWithPagination, GDPRCsvFiles, streamToCSV, toCSV
} from "../CSVUtils";
import { LogsFightsResults } from "../../../../core/database/logs/models/LogsFightsResults";
import { LogsFightsActionsUsed } from "../../../../core/database/logs/models/LogsFightsActionsUsed";
import { LogsPveFightsResults } from "../../../../core/database/logs/models/LogsPveFightsResults";
import { LogsPveFightsActionsUsed } from "../../../../core/database/logs/models/LogsPveFightsActionsUsed";
import { Op } from "sequelize";

type WinnerResult = "me" | "opponent" | "draw";

/**
 * Determine the winner result from the perspective of a specific player
 */
function getWinnerResult(winner: number, myPosition: 1 | 2): WinnerResult {
	if (winner === myPosition) {
		return "me";
	}
	if (winner !== 0 && winner !== myPosition) {
		return "opponent";
	}
	return "draw";
}

/**
 * Fetches and exports PvP fights where the player was initiator or opponent
 */
async function exportPvpFights(
	logsPlayerId: number,
	anonymizer: GDPRAnonymizer,
	csvFiles: GDPRCsvFiles
): Promise<number[]> {
	const fightsAsInitiator = await fetchWithPagination(
		LogsFightsResults,
		{ fightInitiatorId: logsPlayerId },
		f => ({
			id: f.id,
			fightId: f.id,
			role: "initiator" as const,
			opponentId: anonymizer.anonymizePlayerId(f.player2Id, false),
			myPoints: f.fightInitiatorPoints,
			opponentPoints: f.player2Points,
			turns: f.turn,
			winner: getWinnerResult(f.winner, 1),
			friendly: f.friendly,
			date: f.date
		})
	);

	const fightsAsOpponent = await fetchWithPagination(
		LogsFightsResults,
		{ player2Id: logsPlayerId },
		f => ({
			id: f.id,
			fightId: f.id,
			role: "opponent" as const,
			opponentId: anonymizer.anonymizePlayerId(f.fightInitiatorId, false),
			myPoints: f.player2Points,
			opponentPoints: f.fightInitiatorPoints,
			turns: f.turn,
			winner: getWinnerResult(f.winner, 2),
			friendly: f.friendly,
			date: f.date
		})
	);

	const allFights = [...fightsAsInitiator, ...fightsAsOpponent];
	if (allFights.length > 0) {
		csvFiles["logs/45_pvp_fights.csv"] = toCSV(allFights);
	}

	return [...new Set([...fightsAsInitiator.map(f => f.id), ...fightsAsOpponent.map(f => f.id)])];
}

/**
 * Exports PvP fight actions for the given fight IDs
 */
async function exportPvpFightActions(
	fightIds: number[],
	csvFiles: GDPRCsvFiles
): Promise<void> {
	if (fightIds.length === 0) {
		return;
	}

	const fightActions = await LogsFightsActionsUsed.findAll({ where: { fightId: { [Op.in]: fightIds } } });
	if (fightActions.length > 0) {
		csvFiles["logs/46_pvp_fight_actions.csv"] = toCSV(fightActions.map(a => ({
			fightId: a.fightId, actionId: a.actionId, player: a.player, count: a.count
		})));
	}
}

/**
 * Exports PvE fights and their actions
 */
async function exportPveFights(
	logsPlayerId: number,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	const pveFightsCsv = await streamToCSV(
		LogsPveFightsResults,
		{ playerId: logsPlayerId },
		f => ({
			id: f.id,
			monsterId: f.monsterId,
			turns: f.turn,
			winner: f.winner,
			date: f.date
		})
	);
	if (pveFightsCsv) {
		csvFiles["logs/47_pve_fights.csv"] = pveFightsCsv;
	}

	// Fetch PvE fight IDs for actions query
	const pveFightIds = await fetchWithPagination(
		LogsPveFightsResults,
		{ playerId: logsPlayerId },
		f => f.id
	);

	if (pveFightIds.length === 0) {
		return;
	}

	const pveActions = await LogsPveFightsActionsUsed.findAll({ where: { pveFightId: { [Op.in]: pveFightIds } } });
	if (pveActions.length > 0) {
		csvFiles["logs/48_pve_fight_actions.csv"] = toCSV(pveActions.map(a => ({
			pveFightId: a.pveFightId, actionId: a.actionId, count: a.count
		})));
	}
}

/**
 * Exports fights data from logs database (files 45-48)
 */
export async function exportLogsFights(
	logsPlayerId: number,
	anonymizer: GDPRAnonymizer,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	// 45-46. PvP Fights and actions
	const fightIds = await exportPvpFights(logsPlayerId, anonymizer, csvFiles);
	await exportPvpFightActions(fightIds, csvFiles);

	// 47-48. PvE Fights and actions
	await exportPveFights(logsPlayerId, csvFiles);
}
