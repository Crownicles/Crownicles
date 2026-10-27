import { QueryTypes } from "sequelize";
import { ClassInfoConstants } from "../../../../../../Lib/src/constants/ClassInfoConstants";
import { BossLadder } from "../../../report/PveMonsterLevel";
import {
	BossFightsTable, getBossFightsLadder
} from "./LogsBossFightsLadderRequests";
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";
import {
	LogsPveFightsResults, PVE_FIGHT_WINNER
} from "../models/LogsPveFightsResults";

const FAILED_FIGHT_LEVEL_REDUCTION = 10;

type PveMonsterLevelBaseRow = {
	baseLevel: number;
};

const PVE_BOSS_FIGHTS: BossFightsTable = {
	name: "PVE boss",
	model: LogsPveFightsResults,
	table: "pve_fights_results",
	levelColumn: "monsterLevel",
	winners: {
		player: PVE_FIGHT_WINNER.PLAYER,
		opponent: PVE_FIGHT_WINNER.MONSTER
	}
};

export abstract class LogsPveFightProgressionRequests {
	static async getMonsterLevelBase(params: {
		playerKeycloakId: string;
		monsterId: string;
		classId: number;
	}): Promise<number | null> {
		const classIds = ClassInfoConstants.getClassLineage(params.classId);
		try {
			const rows = await LogsPveFightsResults.sequelize!.query<PveMonsterLevelBaseRow>(`
				SELECT pve.monsterLevel
				       - CASE WHEN pve.winner = 1 THEN 0 ELSE :failedFightLevelReduction END AS baseLevel
				FROM pve_fights_results pve
				INNER JOIN players player ON player.id = pve.playerId
				WHERE player.keycloakId = :playerKeycloakId
				  AND pve.monsterId = :monsterId
				  AND pve.classId IN (:classIds)
				ORDER BY CASE WHEN pve.winner = 1 THEN 1 ELSE 0 END DESC,
				         CASE WHEN pve.winner = 1 THEN pve.monsterLevel END DESC,
				         CASE WHEN pve.winner = 1 THEN NULL ELSE pve.date END DESC,
				         pve.id DESC
				LIMIT 1
			`, {
				replacements: {
					playerKeycloakId: params.playerKeycloakId,
					monsterId: params.monsterId,
					classIds,
					failedFightLevelReduction: FAILED_FIGHT_LEVEL_REDUCTION
				},
				type: QueryTypes.SELECT
			});
			return rows[0]?.baseLevel ?? null;
		}
		catch (error) {
			CrowniclesLogger.errorWithObj("Failed to retrieve PVE fight progression, using player level", error);
			return null;
		}
	}

	/**
	 * Get the ladder of a player against a boss, whatever its class: the strongest one of its kind it killed and the last fight against it
	 * (see PVEConstants.LOW_LEVEL_BOSS_LADDER)
	 */
	static getBossLadder(params: {
		playerKeycloakId: string;
		monsterId: string;
	}): Promise<BossLadder> {
		return getBossFightsLadder(PVE_BOSS_FIGHTS, params.playerKeycloakId, {
			condition: "fights.monsterId = :monsterId",
			replacements: { monsterId: params.monsterId }
		});
	}
}
