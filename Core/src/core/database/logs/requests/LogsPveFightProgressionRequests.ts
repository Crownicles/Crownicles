import { QueryTypes } from "sequelize";
import { ClassInfoConstants } from "../../../../../../Lib/src/constants/ClassInfoConstants";
import { LogsPveFightsResults } from "../models/LogsPveFightsResults";

const FAILED_FIGHT_LEVEL_REDUCTION = 10;

type PveMonsterLevelBaseRow = {
	baseLevel: number;
};

export abstract class LogsPveFightProgressionRequests {
	static async getMonsterLevelBase(params: {
		playerKeycloakId: string;
		monsterId: string;
		classId: number;
	}): Promise<number | null> {
		const classIds = ClassInfoConstants.getClassLineage(params.classId);
		const rows = await LogsPveFightsResults.sequelize!.query<PveMonsterLevelBaseRow>(`
			SELECT pve.monsterLevel
			       - CASE WHEN pve.winner = 1 THEN 0 ELSE :failedFightLevelReduction END AS baseLevel
			FROM pve_fights_results pve
			INNER JOIN players player ON player.id = pve.playerId
			WHERE player.keycloakId = :playerKeycloakId
			  AND pve.monsterId = :monsterId
			  AND EXISTS (
				  SELECT 1
				  FROM pve_fights_actions_used actionUsed
				  INNER JOIN fights_actions action ON action.id = actionUsed.actionId
				  WHERE actionUsed.pveFightId = pve.id
				    AND action.classId IN (:classIds)
			  )
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
}
