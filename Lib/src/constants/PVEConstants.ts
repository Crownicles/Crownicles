import { TimeConstants } from "./TimeConstants";

/**
 * Role of a PVE boss in the island trip, which drives how hard it should be
 */
export const PVE_BOSS_ROLES = {
	EARLY: "early",
	MIDDLE: "middle",
	FINAL: "final"
} as const;

export type PveBossRole = typeof PVE_BOSS_ROLES[keyof typeof PVE_BOSS_ROLES];

export abstract class PVEConstants {
	static readonly TIME_AFTER_INACTIVITY_ON_BOAT_IS_NOT_ACCEPTED = 24 * 3 * 3600 * 1000; // 3 days;

	static readonly TIME_BETWEEN_SMALL_EVENTS = 18 * 1000; // 18 seconds

	static readonly TRAVEL_COST = [
		0,
		15,
		25
	];

	static readonly COLLECTOR_TIME = 30000;

	static readonly FIGHT_POINTS_SMALL_EVENT = {
		MIN_PERCENT: 0.02,
		MAX_PERCENT: 0.07
	};

	static readonly MIN_LEVEL = 20;

	static readonly MIN_MONSTER_LEVEL = 1;

	static readonly NON_FINAL_BOSS_MONSTER_LEVEL_RANDOM_OFFSET = {
		MIN: -20,
		MAX: 5
	} as const;

	static readonly NON_FINAL_BOSS_MONSTER_LEVEL_ABOVE_RECORD_PROBABILITY = 0.12;

	static readonly FINAL_BOSS_MONSTER_LEVEL_RANDOM_OFFSET = {
		MIN: -10,
		MAX: 5
	} as const;

	static readonly FINAL_BOSS_MONSTER_LEVEL_ABOVE_RECORD_PROBABILITY = 0.18;

	// From this level, the bosses are drawn around the records of the class lineage, but never below HIGH_LEVEL_MIN_MONSTER_LEVEL
	static readonly LOW_LEVEL_PLAYER_THRESHOLD = 100;

	static readonly HIGH_LEVEL_MIN_MONSTER_LEVEL = 80;

	/**
	 * Below LOW_LEVEL_PLAYER_THRESHOLD, a boss follows the strongest one of its kind the player killed, whatever its class:
	 * it grows a bit after each victory and comes back weaker after a defeat, at the pace of its role in the island trip
	 */
	static readonly LOW_LEVEL_BOSS_LADDER = {
		// Level of a boss met for the first time, as a share of the player level, from MIN_LEVEL to LOW_LEVEL_PLAYER_THRESHOLD
		TARGET_LEVEL_RATIO: {
			[PVE_BOSS_ROLES.EARLY]: {
				AT_MIN_LEVEL: -0.45,
				AT_THRESHOLD: -0.3
			},
			[PVE_BOSS_ROLES.MIDDLE]: {
				AT_MIN_LEVEL: -0.4,
				AT_THRESHOLD: -0.25
			},
			[PVE_BOSS_ROLES.FINAL]: {
				AT_MIN_LEVEL: -0.35,
				AT_THRESHOLD: -0.1
			}
		},
		FIRST_ENCOUNTER_VARIATION: 0.05,

		// A beaten boss below its target level closes this share of the gap, for the players who level up fast
		CATCH_UP_GAP_SHARE: 0.5,
		CATCH_UP_VARIATION: 0.2,

		// Share of its level a boss gains after a victory, and loses after a defeat once moved by the levels the player gained since
		PACE: {
			[PVE_BOSS_ROLES.EARLY]: {
				CLIMB_AFTER_VICTORY: {
					MIN: 0.0025,
					MAX: 0.005
				},
				DROP_AFTER_DEFEAT: 0.25
			},
			[PVE_BOSS_ROLES.MIDDLE]: {
				CLIMB_AFTER_VICTORY: {
					MIN: 0.01,
					MAX: 0.02
				},
				DROP_AFTER_DEFEAT: 0.15
			},
			[PVE_BOSS_ROLES.FINAL]: {
				CLIMB_AFTER_VICTORY: {
					MIN: 0.01,
					MAX: 0.03
				},
				DROP_AFTER_DEFEAT: 0.12
			}
		},

		// After a victory, the boss sometimes comes back a bit weaker instead
		WEAKENED: {
			PROBABILITY: 0.2,
			MIN: -0.08,
			MAX: -0.02
		},

		// Bosses up to this depth of the island are early bosses
		EARLY_BOSS_MAX_DEPTH: 2,

		MAX_LEVELS_BELOW_PLAYER: 20
	};

	/**
	 * The formula is
	 * f(x) = ax² + bx + c
	 * with x the monster lvl
	 */
	static readonly STATS_FORMULA = {
		ATTACK: {
			A: 0.02825,
			B: 0.94359,
			C: 25.56363
		},
		DEFENSE: {
			A: 0.03576,
			B: 0.55352,
			C: 21.67272
		},
		SPEED: {
			A: 0.01359,
			B: 0.21588,
			C: 9.44242
		}
	};

	// Allow commands is better than disallowed commands because if there is a new command it will not be allowed by default


	static readonly FIGHT_REWARDS = {
		RANDOM_MAX_REWARD: 100,
		MONEY_FACTOR: 3.8,
		XP_FACTOR: 6.8,
		GUILD_SCORE_FACTOR: 2.8,
		GUILD_XP_FACTOR: 4.7
	};

	static readonly OUT_OF_BREATH_CHOOSE_PROBABILITY = 0.1;

	static readonly GUILD_ATTACK_PROBABILITY = 0.25;

	static readonly MINIMAL_ENERGY_RATIO = 0.8;

	static readonly RAGE_MIN_MULTIPLIER = 1;

	static readonly TIME_CHECKED_FOR_PLAYERS_THAT_WERE_ON_THE_ISLAND = TimeConstants.MS_TIME.HOUR;

	static readonly RAGE_MAX_DAMAGE = 250;

	static readonly DAMAGE_INCREASED_DURATION = 7;

	static readonly MONEY_MALUS_MULTIPLIER_FOR_GUILD_PLAYERS = 1;

	static readonly MONEY_MALUS_MULTIPLIER_FOR_SOLO_PLAYERS = 2;

	static readonly MONEY_LOST_PER_LEVEL_ON_DEATH = 3.4;

	static readonly GUILD_POINTS_LOST_ON_DEATH = 150;

	static readonly RANDOM_RANGE_FOR_GUILD_POINTS_LOST_ON_DEATH = 20;

	static readonly BOSS_LOOT = {
		MIN_DROPS: 8,
		MAX_DROPS: 18
	};
}
