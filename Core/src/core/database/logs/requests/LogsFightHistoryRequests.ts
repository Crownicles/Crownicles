import { LogsFightsResults } from "../models/LogsFightsResults";
import {
	HasOne, Op
} from "sequelize";
import { LogsPlayers } from "../models/LogsPlayers";
import { LogsDatabase } from "../LogsDatabase";
import { LogsPlayersGloryPoints } from "../models/LogsPlayersGloryPoints";
import { LeagueDataController } from "../../../../data/League";
import { FightHistoryItem } from "../../../../../../Lib/src/packets/commands/CommandFightHistoryPacket";
import { secondsToMilliseconds } from "../../../../../../Lib/src/utils/TimeUtils";
import { EloGameResult } from "../../../../../../Lib/src/types/EloGameResult";

type HistoryCombinedLogsFightsResults = LogsFightsResults & {
	LogsPlayer1: {
		keycloakId: string;
	};
	LogsPlayer2: {
		keycloakId: string;
	};
};

export abstract class LogsFightHistoryRequests {
	/**
	 * Get the fight history of a player
	 * @param keycloakId
	 * @param count - Number of fights to get
	 */
	static async getFightHistory(keycloakId: string, count: number): Promise<FightHistoryItem[]> {
		// Get the fights of the player
		const logPlayer = await LogsDatabase.findOrCreatePlayer(keycloakId);
		const lastFights = await LogsFightHistoryRequests.getLastFightsOfPlayer(logPlayer.id, count);
		const fightsIds = lastFights.map(fight => fight.id);

		// Get the glory points changes of the fights
		const logsFightsGloryPoints = await LogsPlayersGloryPoints.findAll({
			where: {
				fightId: { [Op.in]: fightsIds }
			}
		});

		// Build the fight history items
		return lastFights.map(fight => {
			return this.buildFightHistoryItem(logsFightsGloryPoints, fight, logPlayer);
		});
	}

	/**
	 * Build a fight history item from the logs fights glory points and the fight
	 * @param logsFightsGloryPoints
	 * @param fight
	 * @param logPlayer
	 */
	private static buildFightHistoryItem(logsFightsGloryPoints: LogsPlayersGloryPoints[], fight: HistoryCombinedLogsFightsResults, logPlayer: LogsPlayers): FightHistoryItem {
		const logsGloryPoints = logsFightsGloryPoints.filter(logsGloryPoint => logsGloryPoint.fightId === fight.id);

		// Something is wrong if we don't have 2 glory points changes
		if (logsGloryPoints.length !== 2) {
			throw new Error(`Fight ${fight.id} doesn't have 2 glory points changes`);
		}

		// Glory points logs
		const fightInitiatorGloryPointsLog = logsGloryPoints.find(logsGloryPoint => logsGloryPoint.playerId === fight.fightInitiatorId);
		const player2GloryPointsLog = logsGloryPoints.find(logsGloryPoint => logsGloryPoint.playerId === fight.player2Id);

		// Initial glory
		const fightInitiatorInitialGlory = fight.fightInitiatorInitialDefenseGlory + fight.fightInitiatorInitialAttackGlory;
		const player2InitialGlory = fight.player2InitialDefenseGlory + fight.player2InitialAttackGlory;

		// Glory changes
		const fightInitiatorGloryChange = fightInitiatorGloryPointsLog.isDefense
			? fightInitiatorGloryPointsLog.value - fight.fightInitiatorInitialDefenseGlory
			: fightInitiatorGloryPointsLog.value - fight.fightInitiatorInitialAttackGlory;
		const player2GloryChange = player2GloryPointsLog.isDefense
			? player2GloryPointsLog.value - fight.player2InitialDefenseGlory
			: player2GloryPointsLog.value - fight.player2InitialAttackGlory;

		// Is initiator
		const isInitiator = fight.fightInitiatorId === logPlayer.id;

		// Leagues changes
		const fightInitiatorOldLeague = LeagueDataController.instance.getByGlory(fightInitiatorInitialGlory);
		const player2OldLeague = LeagueDataController.instance.getByGlory(player2InitialGlory);
		const fightInitiatorNewLeague = LeagueDataController.instance.getByGlory(fightInitiatorInitialGlory + fightInitiatorGloryChange);
		const player2NewLeague = LeagueDataController.instance.getByGlory(player2InitialGlory + player2GloryChange);

		// Build the fight history item
		return {
			initiator: isInitiator,
			opponentKeycloakId: isInitiator ? fight.LogsPlayer2.keycloakId : fight.LogsPlayer1.keycloakId,
			date: secondsToMilliseconds(fight.date),
			result: fight.winner === 0
				? EloGameResult.DRAW
				: (fight.winner === 1 && isInitiator) || (fight.winner === 2 && fight.player2Id === logPlayer.id)
					? EloGameResult.WIN
					: EloGameResult.LOSS,
			glory: {
				initial: {
					me: isInitiator ? fightInitiatorInitialGlory : player2InitialGlory,
					opponent: isInitiator ? player2InitialGlory : fightInitiatorInitialGlory
				},
				change: {
					me: isInitiator ? fightInitiatorGloryChange : player2GloryChange,
					opponent: isInitiator ? player2GloryChange : fightInitiatorGloryChange
				},
				leaguesChanges: {
					me: fightInitiatorOldLeague !== fightInitiatorNewLeague
						? {
							oldLeague: fightInitiatorOldLeague.id,
							newLeague: fightInitiatorNewLeague.id
						}
						: undefined,
					opponent: player2OldLeague !== player2NewLeague
						? {
							oldLeague: player2OldLeague.id,
							newLeague: player2NewLeague.id
						}
						: undefined
				}
			},
			classes: {
				me: isInitiator ? fight.fightInitiatorClassId : fight.player2ClassId,
				opponent: isInitiator ? fight.player2ClassId : fight.fightInitiatorClassId
			}
		};
	}

	/**
	 * Get the last fights of a player
	 * @param logPlayerId - The id of the player in the logs database
	 * @param count - The number of fights to get
	 */
	private static async getLastFightsOfPlayer(logPlayerId: number, count: number): Promise<HistoryCombinedLogsFightsResults[]> {
		return await LogsFightsResults.findAll({
			where: {
				[Op.or]: [
					{ fightInitiatorId: logPlayerId },
					{ player2Id: logPlayerId }
				],
				[Op.not]: { // Only new fights have the property set
					fightInitiatorInitialDefenseGlory: null
				}
			},
			order: [["date", "DESC"]],
			include: [
				{
					model: LogsPlayers,
					association: new HasOne(LogsFightsResults, LogsPlayers, {
						sourceKey: "fightInitiatorId",
						foreignKey: "id",
						as: "LogsPlayer1"
					})
				}, {
					model: LogsPlayers,
					association: new HasOne(LogsFightsResults, LogsPlayers, {
						sourceKey: "player2Id",
						foreignKey: "id",
						as: "LogsPlayer2"
					})
				}
			],
			limit: count
		}) as unknown as HistoryCombinedLogsFightsResults[];
	}
}
