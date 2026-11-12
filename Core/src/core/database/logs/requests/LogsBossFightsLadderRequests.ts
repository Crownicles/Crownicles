import {
	Model, ModelStatic, QueryTypes
} from "sequelize";
import { CrowniclesLogger } from "../../../../../../Lib/src/logs/CrowniclesLogger";
import { BossLadder } from "../../../report/PveMonsterLevel";
import { getModelSequelize } from "../../../../../../Lib/src/database/ModelUtils";

/**
 * Log table of the fights against opponents whose level follows the player progression: the PVE bosses
 */
export type BossFightsTable = {
	name: string;
	model: ModelStatic<Model>;
	table: string;
	levelColumn: string;
	winners: {
		player: number;
		opponent: number;
	};
};

/**
 * Restriction of the fights of a player to some opponents, as an SQL condition on the `fights` alias and its replacements
 */
export type BossFightsFilter = {
	condition: string;
	replacements: Record<string, unknown>;
};

type StrongestVictoryRow = {
	level: number | null;
};

type LastFightRow = {
	level: number;
	winner: number;
	playerLevel: number | null;
};

const NO_LADDER: BossLadder = {
	strongestVictoryLevel: null,
	lastFight: null
};

/**
 * Get the ladder of a player against the opponents of the table, whatever its class: the strongest one it beat and its last fight
 * (see PVEConstants.LOW_LEVEL_BOSS_LADDER)
 * @param bossFights
 * @param playerKeycloakId
 * @param filter Restriction to some opponents, all of them when not given
 */
export async function getBossFightsLadder(bossFights: BossFightsTable, playerKeycloakId: string, filter?: BossFightsFilter): Promise<BossLadder> {
	const fightsOfPlayer = `
		FROM ${bossFights.table} fights
		INNER JOIN players player ON player.id = fights.playerId
		WHERE player.keycloakId = :playerKeycloakId
		${filter ? `AND ${filter.condition}` : ""}
	`;
	const options = {
		replacements: {
			...filter?.replacements,
			playerKeycloakId,
			playerWinner: bossFights.winners.player
		},
		type: QueryTypes.SELECT
	} as const;
	try {
		const [[strongestVictory], [lastFight]] = await Promise.all([
			getModelSequelize(bossFights.model).query<StrongestVictoryRow>(
				`SELECT MAX(fights.${bossFights.levelColumn}) AS level ${fightsOfPlayer} AND fights.winner = :playerWinner`,
				options
			),
			getModelSequelize(bossFights.model).query<LastFightRow>(
				`SELECT fights.${bossFights.levelColumn} AS level, fights.winner, fights.playerLevel ${fightsOfPlayer} ORDER BY fights.id DESC LIMIT 1`,
				options
			)
		]);
		return {
			strongestVictoryLevel: strongestVictory?.level ?? null,
			lastFight: lastFight
				? {
					level: lastFight.level,
					isDefeat: lastFight.winner === bossFights.winners.opponent,
					playerLevel: lastFight.playerLevel
				}
				: null
		};
	}
	catch (error) {
		CrowniclesLogger.errorWithObj(`Failed to retrieve the ${bossFights.name} ladder, drawing the opponent around the player level`, error);
		return NO_LADDER;
	}
}
