import {
	MersenneTwister19937, Random
} from "random-js";
import {
	PVE_BOSS_ROLES, PVEConstants, PveBossRole
} from "../../../../Lib/src/constants/PVEConstants";
import { MathUtils } from "../utils/MathUtils";

/**
 * Ladder of a player against a boss, whatever its class: the strongest one of its kind it killed and the last fight against it
 */
export type BossLadder = {
	strongestVictoryLevel: number | null;
	lastFight: {
		level: number;
		isDefeat: boolean;

		// Level of the player during the fight, null for the fights logged before it was
		playerLevel: number | null;
	} | null;
};

/**
 * Whether the bosses of a player follow its ladder instead of the records of its class lineage
 * @param playerLevel
 */
export function isLowLevelPlayer(playerLevel: number): boolean {
	return playerLevel < PVEConstants.LOW_LEVEL_PLAYER_THRESHOLD;
}

/**
 * Location of a boss on the PVE island
 */
export type PveBossLocation = {
	depth: number;
	isFinal: boolean;
};

/**
 * Get the role of a boss in the island trip from its location
 * @param location
 */
export function getPveBossRole(location: PveBossLocation): PveBossRole {
	if (location.isFinal) {
		return PVE_BOSS_ROLES.FINAL;
	}
	return location.depth <= PVEConstants.LOW_LEVEL_BOSS_LADDER.EARLY_BOSS_MAX_DEPTH ? PVE_BOSS_ROLES.EARLY : PVE_BOSS_ROLES.MIDDLE;
}

/**
 * Target level of a boss on the ladder of a player below LOW_LEVEL_PLAYER_THRESHOLD, as a share of the player level
 * @param role
 * @param playerLevel
 */
export function getLowLevelBossTargetLevelRatio(role: PveBossRole, playerLevel: number): number {
	const targetRatio = PVEConstants.LOW_LEVEL_BOSS_LADDER.TARGET_LEVEL_RATIO[role];
	const levelProgress = MathUtils.clamp(
		(playerLevel - PVEConstants.MIN_LEVEL) / (PVEConstants.LOW_LEVEL_PLAYER_THRESHOLD - PVEConstants.MIN_LEVEL),
		0,
		1
	);
	return MathUtils.getIntervalValue(targetRatio.AT_MIN_LEVEL, targetRatio.AT_THRESHOLD, levelProgress);
}

/**
 * Level of a boss coming back after a victory against it from its target level: stronger than the strongest one killed
 * by a share of its level, rounded up or down at random so that the slowest paces still grow on average
 * @param strongestVictoryLevel
 * @param role
 * @param random
 */
function climbBossLadder(strongestVictoryLevel: number, role: PveBossRole, random: Random): number {
	const climbRange = PVEConstants.LOW_LEVEL_BOSS_LADDER.PACE[role].CLIMB_AFTER_VICTORY;
	const climbLevels = strongestVictoryLevel * random.real(climbRange.MIN, climbRange.MAX);
	return strongestVictoryLevel + Math.floor(climbLevels) + (random.real(0, 1) < climbLevels % 1 ? 1 : 0);
}

/**
 * Draw the next level of a boss on the ladder of a player
 * @param params.targetLevel Level the bosses of this role are drawn around the first time
 */
function drawBossLadderLevel(params: {
	ladder: BossLadder;
	playerLevel: number;
	role: PveBossRole;
	targetLevel: number;
}, random: Random): number {
	const ladderConstants = PVEConstants.LOW_LEVEL_BOSS_LADDER;
	const {
		lastFight, strongestVictoryLevel
	} = params.ladder;
	if (lastFight?.isDefeat) {
		const progressSinceDefeat = params.playerLevel / (lastFight.playerLevel ?? params.playerLevel);
		return lastFight.level * progressSinceDefeat * (1 - ladderConstants.PACE[params.role].DROP_AFTER_DEFEAT);
	}
	if (strongestVictoryLevel === null) {
		return params.targetLevel * (1 + random.real(-ladderConstants.FIRST_ENCOUNTER_VARIATION, ladderConstants.FIRST_ENCOUNTER_VARIATION));
	}
	if (random.real(0, 1) < ladderConstants.WEAKENED.PROBABILITY) {
		return strongestVictoryLevel * (1 + random.real(ladderConstants.WEAKENED.MIN, ladderConstants.WEAKENED.MAX));
	}
	if (strongestVictoryLevel < params.targetLevel) {
		const catchUpLevels = (params.targetLevel - strongestVictoryLevel) * ladderConstants.CATCH_UP_GAP_SHARE
			* (1 + random.real(-ladderConstants.CATCH_UP_VARIATION, ladderConstants.CATCH_UP_VARIATION));
		return strongestVictoryLevel + Math.max(1, catchUpLevels);
	}
	return climbBossLadder(strongestVictoryLevel, params.role, random);
}

/**
 * Draw the level of a PVE boss (or a king guard) for a player below LOW_LEVEL_PLAYER_THRESHOLD, from its ladder against it
 * @param params.role Role of the boss in the island trip, the king guards being middle bosses
 */
export function getLowLevelPveMonsterLevel(params: {
	ladder: BossLadder;
	playerLevel: number;
	seed: number;
	role: PveBossRole;
}): number {
	const ladderLevel = drawBossLadderLevel(
		{
			...params,
			targetLevel: params.playerLevel * (1 + getLowLevelBossTargetLevelRatio(params.role, params.playerLevel))
		},
		new Random(MersenneTwister19937.seed(params.seed))
	);
	return Math.max(
		PVEConstants.MIN_MONSTER_LEVEL,
		params.playerLevel - PVEConstants.LOW_LEVEL_BOSS_LADDER.MAX_LEVELS_BELOW_PLAYER,
		Math.round(ladderLevel)
	);
}
