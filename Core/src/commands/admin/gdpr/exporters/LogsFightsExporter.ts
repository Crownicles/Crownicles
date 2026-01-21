import { GDPRAnonymizer } from "../GDPRAnonymizer";
import {
	fetchWithPagination, GDPRCsvFiles, streamToCSV, toCSV
} from "../CSVUtils";
import { LogsFightsResults } from "../../../../core/database/logs/models/LogsFightsResults";
import { LogsFightsActionsUsed } from "../../../../core/database/logs/models/LogsFightsActionsUsed";
import { LogsPveFightsResults } from "../../../../core/database/logs/models/LogsPveFightsResults";
import { LogsPveFightsActionsUsed } from "../../../../core/database/logs/models/LogsPveFightsActionsUsed";
import { Op } from "sequelize";

/**
 * Exports fights data from logs database (files 45-48)
 */
export async function exportLogsFights(
	logsPlayerId: number,
	anonymizer: GDPRAnonymizer,
	csvFiles: GDPRCsvFiles
): Promise<void> {
	/*
	 * 45. PvP Fights (where player was initiator OR opponent)
	 * Use fetchWithPagination because we need the fight IDs for actions query
	 */
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
			winner: f.winner === 1 ? "me" : f.winner === 2 ? "opponent" : "draw",
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
			winner: f.winner === 2 ? "me" : f.winner === 1 ? "opponent" : "draw",
			friendly: f.friendly,
			date: f.date
		})
	);
	const allFights = [...fightsAsInitiator, ...fightsAsOpponent];
	if (allFights.length > 0) {
		csvFiles["logs/45_pvp_fights.csv"] = toCSV(allFights);
	}

	/*
	 * 46. Fight actions used (for player's fights)
	 * Keep findAll with Op.in since IDs are already filtered
	 */
	const fightIds = [...new Set([...fightsAsInitiator.map(f => f.id), ...fightsAsOpponent.map(f => f.id)])];
	if (fightIds.length > 0) {
		const fightActions = await LogsFightsActionsUsed.findAll({ where: { fightId: { [Op.in]: fightIds } } });
		if (fightActions.length > 0) {
			csvFiles["logs/46_pvp_fight_actions.csv"] = toCSV(fightActions.map(a => ({
				fightId: a.fightId, actionId: a.actionId, player: a.player, count: a.count
			})));
		}
	}

	// 47. PvE Fights - use streamToCSV for direct CSV output
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

	// 48. PvE fight actions - need to fetch PvE fight IDs first
	const pveFightIds = await fetchWithPagination(
		LogsPveFightsResults,
		{ playerId: logsPlayerId },
		f => f.id
	);
	if (pveFightIds.length > 0) {
		// Keep findAll with Op.in since IDs are already filtered
		const pveActions = await LogsPveFightsActionsUsed.findAll({ where: { pveFightId: { [Op.in]: pveFightIds } } });
		if (pveActions.length > 0) {
			csvFiles["logs/48_pve_fight_actions.csv"] = toCSV(pveActions.map(a => ({
				pveFightId: a.pveFightId, actionId: a.actionId, count: a.count
			})));
		}
	}
}
