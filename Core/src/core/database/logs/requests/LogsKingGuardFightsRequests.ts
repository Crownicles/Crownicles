import { QueryTypes } from "sequelize";
import { ClassInfoConstants } from "../../../../../../Lib/src/constants/ClassInfoConstants";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { BossLadder } from "../../../report/PveMonsterLevel";
import {
	BossFightsTable, getBossFightsLadder
} from "./LogsBossFightsLadderRequests";
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";
import {
	KING_GUARD_FIGHT_WINNER, LogsKingGuardFightsResults
} from "../models/LogsKingGuardFightsResults";
import {
	dateToLogs, getTodayMidnight
} from "../../../../../../Lib/src/utils/TimeUtils";
import type { PersonalFightDailySummary } from "../LogsReadRequests";

type KingGuardLevelBaseRow = {
	baseLevel: number;
};

const KING_GUARD_FIGHTS: BossFightsTable = {
	name: "king guard",
	model: LogsKingGuardFightsResults,
	table: "king_guard_fights_results",
	levelColumn: "guardLevel",
	winners: {
		player: KING_GUARD_FIGHT_WINNER.PLAYER,
		opponent: KING_GUARD_FIGHT_WINNER.GUARD
	}
};

export abstract class LogsKingGuardFightsRequests {
	/**
	 * Get the level the next king guard of a player is based on: the best guard beaten with this class lineage,
	 * or the last guard lost against minus a reduction, like the PvE bosses.
	 * The base may be negative: the generated guard level is clamped afterwards by computeKingGuardLevel
	 */
	static async getGuardLevelBase(params: {
		playerKeycloakId: string;
		classId: number;
	}): Promise<number | null> {
		try {
			// guardLevel is unsigned: subtracting from it directly fails (error 1690) when the result is negative
			const rows = await LogsKingGuardFightsResults.sequelize!.query<KingGuardLevelBaseRow>(`
				SELECT CAST(guard.guardLevel AS SIGNED)
				       - CASE WHEN guard.winner = 1 THEN 0 ELSE :failedFightLevelReduction END AS baseLevel
				FROM king_guard_fights_results guard
				INNER JOIN players player ON player.id = guard.playerId
				WHERE player.keycloakId = :playerKeycloakId
				  AND guard.classId IN (:classIds)
				ORDER BY CASE WHEN guard.winner = 1 THEN 1 ELSE 0 END DESC,
				         CASE WHEN guard.winner = 1 THEN guard.guardLevel END DESC,
				         CASE WHEN guard.winner = 1 THEN NULL ELSE guard.date END DESC,
				         guard.id DESC
				LIMIT 1
			`, {
				replacements: {
					playerKeycloakId: params.playerKeycloakId,
					classIds: ClassInfoConstants.getClassLineage(params.classId),
					failedFightLevelReduction: FightConstants.KING_GUARD.FAILED_FIGHT_LEVEL_REDUCTION
				},
				type: QueryTypes.SELECT
			});
			return rows[0]?.baseLevel ?? null;
		}
		catch (error) {
			CrowniclesLogger.errorWithObj("Failed to retrieve king guard progression, using player level", error);
			return null;
		}
	}

	/**
	 * Get the ladder of a player against the king guards, whatever its class: the strongest guard it beat and its last guard fight
	 * (see PVEConstants.LOW_LEVEL_BOSS_LADDER)
	 */
	static getGuardLadder(playerKeycloakId: string): Promise<BossLadder> {
		return getBossFightsLadder(KING_GUARD_FIGHTS, playerKeycloakId);
	}

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
}
