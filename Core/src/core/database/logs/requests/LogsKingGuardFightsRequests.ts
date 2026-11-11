import { QueryTypes } from "sequelize";
import {
	KING_GUARD_FIGHT_WINNER, LogsKingGuardFightsResults
} from "../models/LogsKingGuardFightsResults";
import {
	dateToLogs, getTodayMidnight
} from "../../../../../../Lib/src/utils/TimeUtils";
import type { PersonalFightDailySummary } from "../LogsReadRequests";

type KingGuardTallyKey = "played" | "won" | "lost" | "draw";

type KingGuardTallyRow = Record<KingGuardTallyKey, number | string | null>;

/**
 * Results of a player against the king guards
 */
export type KingGuardFightTally = Record<KingGuardTallyKey, number>;

/**
 * A guard of the library beaten by a player, and the fight in which the player first beat it: the dates of the logs are in
 * seconds, so the id of that fight orders the players who beat it in the same second
 */
export type KingGuardVictory = {
	keycloakId: string;
	guardId: number;
	firstDate: number;
	firstFightId: number;
};

export abstract class LogsKingGuardFightsRequests {
	/**
	 * Get the last king guard fights of a player, most recent first
	 * @param logPlayerId - The id of the player in the logs database
	 * @param count - The number of fights to get
	 */
	static async getLastFightsOfPlayer(logPlayerId: number, count: number): Promise<LogsKingGuardFightsResults[]> {
		return await LogsKingGuardFightsResults.findAll({
			where: { playerId: logPlayerId },
			order: [["date", "DESC"], ["id", "DESC"]],
			limit: count
		});
	}

	/**
	 * Get the guards of the library a player fought last, the most recent first (a guard fought several times is listed once)
	 * @param playerKeycloakId
	 * @param count - The number of fights to look at
	 */
	static async getLastGuardIds(playerKeycloakId: string, count: number): Promise<number[]> {
		const rows = await LogsKingGuardFightsResults.sequelize!.query<{ guardId: number }>(`
			SELECT fight.guardId
			FROM king_guard_fights_results fight
			INNER JOIN players player ON player.id = fight.playerId
			WHERE player.keycloakId = :playerKeycloakId
			  AND fight.guardId IS NOT NULL
			ORDER BY fight.date DESC, fight.id DESC
			LIMIT :count
		`, {
			replacements: {
				playerKeycloakId,
				count
			},
			type: QueryTypes.SELECT
		});
		return [...new Set(rows.map(row => Number(row.guardId)))];
	}

	/**
	 * Count the fights of a player against the guards of the library, which moved its hidden rating
	 * @param playerKeycloakId
	 */
	static async countRatedFights(playerKeycloakId: string): Promise<number> {
		const [row] = await LogsKingGuardFightsResults.sequelize!.query<{ count: number | string }>(`
			SELECT COUNT(*) AS count
			FROM king_guard_fights_results fight
			INNER JOIN players player ON player.id = fight.playerId
			WHERE player.keycloakId = :playerKeycloakId
			  AND fight.guardId IS NOT NULL
		`, {
			replacements: { playerKeycloakId },
			type: QueryTypes.SELECT
		});
		return Number(row?.count ?? 0);
	}

	/**
	 * Get the king guard fights played today by a player
	 * @param playerKeycloakId
	 */
	static async getDailySummary(playerKeycloakId: string): Promise<PersonalFightDailySummary> {
		const [summary] = await LogsKingGuardFightsResults.sequelize!.query<Record<keyof PersonalFightDailySummary, number | string | null>>(`
			SELECT COUNT(*) AS played,
			       SUM(guard.winner = 1) AS won,
			       SUM(guard.winner = 0) AS draw
			FROM king_guard_fights_results guard
			INNER JOIN players player ON player.id = guard.playerId
			WHERE player.keycloakId = :playerKeycloakId
			  AND guard.date > :startTimestamp
		`, {
			replacements: {
				playerKeycloakId,
				startTimestamp: dateToLogs(getTodayMidnight())
			},
			type: QueryTypes.SELECT
		});
		return {
			played: Number(summary?.played ?? 0),
			won: Number(summary?.won ?? 0),
			draw: Number(summary?.draw ?? 0)
		};
	}

	/**
	 * Count the results of a player against the king guards
	 * @param playerKeycloakId
	 */
	static async getFightTally(playerKeycloakId: string): Promise<KingGuardFightTally> {
		const [tally] = await LogsKingGuardFightsResults.sequelize!.query<KingGuardTallyRow>(`
			SELECT COUNT(*) AS played,
			       SUM(fight.winner = :playerWinner) AS won,
			       SUM(fight.winner = :guardWinner) AS lost,
			       SUM(fight.winner = :draw) AS draw
			FROM king_guard_fights_results fight
			INNER JOIN players player ON player.id = fight.playerId
			WHERE player.keycloakId = :playerKeycloakId
		`, {
			replacements: {
				playerKeycloakId,
				playerWinner: KING_GUARD_FIGHT_WINNER.PLAYER,
				guardWinner: KING_GUARD_FIGHT_WINNER.GUARD,
				draw: KING_GUARD_FIGHT_WINNER.DRAW
			},
			type: QueryTypes.SELECT
		});
		return {
			played: Number(tally?.played ?? 0),
			won: Number(tally?.won ?? 0),
			lost: Number(tally?.lost ?? 0),
			draw: Number(tally?.draw ?? 0)
		};
	}

	/**
	 * Get every guard of the library each player beat, with the fight in which it first beat it
	 */
	static async getVictories(): Promise<KingGuardVictory[]> {
		const rows = await LogsKingGuardFightsResults.sequelize!.query<Record<keyof KingGuardVictory, number | string>>(`
			SELECT player.keycloakId,
			       fight.guardId,
			       MIN(fight.date) AS firstDate,
			       MIN(fight.id) AS firstFightId
			FROM king_guard_fights_results fight
			INNER JOIN players player ON player.id = fight.playerId
			WHERE fight.winner = :playerWinner
			  AND fight.guardId IS NOT NULL
			GROUP BY fight.playerId, player.keycloakId, fight.guardId
		`, {
			replacements: { playerWinner: KING_GUARD_FIGHT_WINNER.PLAYER },
			type: QueryTypes.SELECT
		});
		return rows.map(row => ({
			keycloakId: String(row.keycloakId),
			guardId: Number(row.guardId),
			firstDate: Number(row.firstDate),
			firstFightId: Number(row.firstFightId)
		}));
	}
}
