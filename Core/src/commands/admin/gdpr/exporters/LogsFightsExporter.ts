import { GDPRAnonymizer } from "../GDPRAnonymizer";
import {
	toCSV, GDPRCsvFiles
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
	// 45. PvP Fights (where player was initiator OR opponent)
	const fightsAsInitiator = await LogsFightsResults.findAll({ where: { fightInitiatorId: logsPlayerId } });
	const fightsAsOpponent = await LogsFightsResults.findAll({ where: { player2Id: logsPlayerId } });
	const allFights = [
		...fightsAsInitiator.map(f => ({
			fightId: f.id,
			role: "initiator",
			opponentId: anonymizer.anonymizePlayerId(f.player2Id, false),
			myPoints: f.fightInitiatorPoints,
			opponentPoints: f.player2Points,
			turns: f.turn,
			winner: f.winner === 1 ? "me" : f.winner === 2 ? "opponent" : "draw",
			friendly: f.friendly,
			date: f.date
		})),
		...fightsAsOpponent.map(f => ({
			fightId: f.id,
			role: "opponent",
			opponentId: anonymizer.anonymizePlayerId(f.fightInitiatorId, false),
			myPoints: f.player2Points,
			opponentPoints: f.fightInitiatorPoints,
			turns: f.turn,
			winner: f.winner === 2 ? "me" : f.winner === 1 ? "opponent" : "draw",
			friendly: f.friendly,
			date: f.date
		}))
	];
	if (allFights.length > 0) {
		csvFiles["logs/45_pvp_fights.csv"] = toCSV(allFights);
	}

	// 46. Fight actions used (for player's fights)
	const fightIds = [...new Set([...fightsAsInitiator.map(f => f.id), ...fightsAsOpponent.map(f => f.id)])];
	if (fightIds.length > 0) {
		const fightActions = await LogsFightsActionsUsed.findAll({ where: { fightId: { [Op.in]: fightIds } } });
		if (fightActions.length > 0) {
			csvFiles["logs/46_pvp_fight_actions.csv"] = toCSV(fightActions.map(a => ({
				fightId: a.fightId, actionId: a.actionId, player: a.player, count: a.count
			})));
		}
	}

	// 47. PvE Fights
	const pveFights = await LogsPveFightsResults.findAll({ where: { playerId: logsPlayerId } });
	if (pveFights.length > 0) {
		csvFiles["logs/47_pve_fights.csv"] = toCSV(pveFights.map(f => ({
			monsterId: f.monsterId, turns: f.turn, winner: f.winner, date: f.date
		})));
	}

	// 48. PvE fight actions
	const pveFightIds = pveFights.map(f => f.id);
	if (pveFightIds.length > 0) {
		const pveActions = await LogsPveFightsActionsUsed.findAll({ where: { pveFightId: { [Op.in]: pveFightIds } } });
		if (pveActions.length > 0) {
			csvFiles["logs/48_pve_fight_actions.csv"] = toCSV(pveActions.map(a => ({
				pveFightId: a.pveFightId, actionId: a.actionId, count: a.count
			})));
		}
	}
}
