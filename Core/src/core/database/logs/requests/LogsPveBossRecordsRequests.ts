import { QueryTypes } from "sequelize";
import { ClassConstants } from "../../../../../../Lib/src/constants/ClassConstants";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import {
	FinalPveBossId, PveBossFightRecord, PveBossLeaderboardEntry, PveBossPersonalRecord
} from "../../../../../../Lib/src/types/PveBossRecord";
import { ClassDataController } from "../../../../data/Class";
import { LogsPveFightsResults } from "../models/LogsPveFightsResults";
import {
	selectPersonalBossRecords
} from "./LogsPveBossRecordsUtils";

const LEADERBOARD_LIMIT = 10;
const FINAL_BOSS_IDS = Object.values(FightConstants.FINAL_BOSS_MONSTER_IDS);
const FINAL_BOSS_ID_SET = new Set<string>(FINAL_BOSS_IDS);

type PveBossFightRow = {
	fightId: number;
	playerKeycloakId: string;
	monsterId: FinalPveBossId;
	monsterLevel: number;
	classId: number;
	turns: number;
	date: number;
	actionId: string;
	actionCount: number;
};

function groupFightRows(rows: PveBossFightRow[]): PveBossFightRecord[] {
	const recordsByFight = new Map<number, PveBossFightRecord>();
	for (const row of rows) {
		const existing = recordsByFight.get(row.fightId);
		if (existing) {
			existing.actions.push({
				actionId: row.actionId,
				count: row.actionCount
			});
			continue;
		}
		recordsByFight.set(row.fightId, {
			playerKeycloakId: row.playerKeycloakId,
			monsterId: row.monsterId,
			monsterLevel: row.monsterLevel,
			classId: row.classId,
			turns: row.turns,
			date: row.date,
			actions: [
				{
					actionId: row.actionId,
					count: row.actionCount
				}
			]
		});
	}
	return [...recordsByFight.values()];
}

async function queryBossFightRows(whereClause: string, replacements: Record<string, unknown>): Promise<PveBossFightRow[]> {
	return await LogsPveFightsResults.sequelize!.query<PveBossFightRow>(`
		SELECT pve.id AS fightId,
		       player.keycloakId AS playerKeycloakId,
		       pve.monsterId,
		       pve.monsterLevel,
		       action.classId,
		       pve.turn AS turns,
		       pve.date,
		       action.name AS actionId,
		       actionUsed.count AS actionCount
		FROM pve_fights_results pve
		INNER JOIN players player ON player.id = pve.playerId
		INNER JOIN pve_fights_actions_used actionUsed ON actionUsed.pveFightId = pve.id
		INNER JOIN fights_actions action ON action.id = actionUsed.actionId
		WHERE pve.winner = 1
		  AND ${whereClause}
		ORDER BY pve.monsterLevel DESC, pve.turn ASC, pve.date ASC, pve.id ASC
	`, {
		replacements,
		type: QueryTypes.SELECT
	});
}

async function queryBossLeaderboard(monsterId: string, classId: number): Promise<PveBossLeaderboardEntry[]> {
	return await LogsPveFightsResults.sequelize!.query<PveBossLeaderboardEntry>(`
		WITH ranked_records AS (
			SELECT player.keycloakId AS playerKeycloakId,
			       pve.id AS fightId,
			       pve.monsterId,
			       pve.monsterLevel,
			       :classId AS classId,
			       pve.turn AS turns,
			       pve.date,
			       ROW_NUMBER() OVER (
				       PARTITION BY player.keycloakId
				       ORDER BY pve.monsterLevel DESC, pve.turn ASC, pve.date ASC, pve.id ASC
			       ) AS playerRank
			FROM pve_fights_results pve
			INNER JOIN players player ON player.id = pve.playerId
			WHERE pve.winner = 1
			  AND pve.monsterId = :monsterId
			  AND EXISTS (
				  SELECT 1
				  FROM pve_fights_actions_used actionUsed
				  INNER JOIN fights_actions action ON action.id = actionUsed.actionId
				  WHERE actionUsed.pveFightId = pve.id
				    AND action.classId = :classId
			  )
		)
		SELECT playerKeycloakId, monsterId, monsterLevel, classId, turns, date
		FROM ranked_records
		WHERE playerRank = 1
		ORDER BY monsterLevel DESC, turns ASC, date ASC, fightId ASC
		LIMIT :limit
	`, {
		replacements: {
			monsterId, classId, limit: LEADERBOARD_LIMIT
		},
		type: QueryTypes.SELECT
	});
}

export abstract class LogsPveBossRecordsRequests {
	static getMaximumTierClassIds(): number[] {
		return ClassDataController.instance.getByGroup(ClassConstants.MAX_CLASS_GROUP).map(playerClass => playerClass.id);
	}

	static async getPersonalRecords(playerKeycloakId: string): Promise<PveBossPersonalRecord[]> {
		const rows = await queryBossFightRows(
			"player.keycloakId = :playerKeycloakId AND pve.monsterId IN (:bossIds)",
			{
				playerKeycloakId, bossIds: FINAL_BOSS_IDS
			}
		);
		return selectPersonalBossRecords(groupFightRows(rows));
	}

	static async getLeaderboard(monsterId: string, classId: number): Promise<PveBossLeaderboardEntry[]> {
		const maximumTierClassIds = this.getMaximumTierClassIds();
		if (!FINAL_BOSS_ID_SET.has(monsterId) || !maximumTierClassIds.includes(classId)) {
			return [];
		}
		return await queryBossLeaderboard(monsterId, classId);
	}
}
