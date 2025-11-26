/**
 * Constants for the Pet Expedition system
 * Players can send their pet on expeditions to earn rewards based on duration, risk, and difficulty
 */
export abstract class ExpeditionConstants {
	/**
	 * Duration limits for expeditions (in minutes)
	 */
	static readonly DURATION = {
		MIN_MINUTES: 10,
		MAX_MINUTES: 3 * 24 * 60 // 3 days in minutes
	};

	/**
	 * Risk rate categories for display purposes
	 * Risk rate is a percentage from 0 to 100
	 */
	static readonly RISK_CATEGORIES = {
		LOW: {
			MAX: 10,
			NAME: "low"
		},
		MODERATE: {
			MAX: 20,
			NAME: "moderate"
		},
		RISKY: {
			MAX: 40,
			NAME: "risky"
		},
		VERY_RISKY: {
			MAX: 100,
			NAME: "veryRisky"
		}
	};

	/**
	 * Wealth rate categories for display purposes
	 * Wealth rate is a multiplier from 0.0 to 2.0
	 */
	static readonly WEALTH_CATEGORIES = {
		VERY_LOW: {
			MAX: 0.5,
			NAME: "veryLow"
		},
		LOW: {
			MAX: 1.0,
			NAME: "low"
		},
		GOOD: {
			MAX: 1.5,
			NAME: "good"
		},
		INCREDIBLE: {
			MAX: 2.0,
			NAME: "incredible"
		}
	};

	/**
	 * Difficulty range (0 to 100)
	 */
	static readonly DIFFICULTY = {
		MIN: 0,
		MAX: 100
	};

	/**
	 * Wealth rate range (multiplier)
	 */
	static readonly WEALTH_RATE = {
		MIN: 0.0,
		MAX: 2.0
	};

	/**
	 * Risk rate range (percentage)
	 */
	static readonly RISK_RATE = {
		MIN: 0,
		MAX: 100
	};

	/**
	 * Requirements to start an expedition
	 */
	static readonly REQUIREMENTS = {
		MIN_LOVE_POINTS: 80,
		MIN_LEVEL_FOR_TALISMAN: 20
	};

	/**
	 * Love points changes during expedition lifecycle
	 */
	static readonly LOVE_CHANGES = {
		CANCEL_BEFORE_DEPARTURE: -15,
		RECALL_DURING_EXPEDITION: -25,
		TOTAL_FAILURE: -10,
		TOTAL_SUCCESS: 5
	};

	/**
	 * Formula coefficients for effective risk calculation
	 * effective_risk = initial_risk + (difficulty / DIFFICULTY_DIVISOR) - pet_force - (love / LOVE_DIVISOR)
	 */
	static readonly EFFECTIVE_RISK_FORMULA = {
		DIFFICULTY_DIVISOR: 3,
		LOVE_DIVISOR: 10
	};

	/**
	 * Multiplier applied to effective risk when player has insufficient food
	 */
	static readonly NO_FOOD_RISK_MULTIPLIER: 3;

	/**
	 * Number of expeditions proposed to the player
	 */
	static readonly EXPEDITIONS_PROPOSED: 3;

	/**
	 * Reward tables (10 slots each, index 0-9)
	 * Index is calculated from: duration_score + risk_score + difficulty_score (each 0-3)
	 */
	static readonly REWARD_TABLES = {
		MONEY: [
			50,
			75,
			100,
			150,
			200,
			275,
			350,
			450,
			600,
			800
		],
		GEMS: [
			0,
			0,
			1,
			1,
			1,
			2,
			2,
			3,
			3,
			5
		],
		EXPERIENCE: [
			10,
			20,
			35,
			50,
			75,
			100,
			150,
			200,
			275,
			400
		],
		GUILD_EXPERIENCE: [
			5,
			10,
			20,
			30,
			45,
			60,
			80,
			110,
			150,
			200
		],
		POINTS: [
			10,
			20,
			35,
			50,
			70,
			100,
			140,
			190,
			250,
			350
		]
	};

	/**
	 * Food consumption table (10 slots, index 0-9)
	 * Higher index = more food required
	 */
	static readonly FOOD_CONSUMPTION = [
		1,
		1,
		2,
		2,
		3,
		3,
		4,
		4,
		5,
		6
	];

	/**
	 * Score thresholds for converting values to 0-3 range
	 * Each attribute (duration, risk, difficulty) is converted to a score 0-3
	 */
	static readonly SCORE_THRESHOLDS = {
		// Duration thresholds in minutes
		DURATION: {
			SCORE_1: 60, // 1 hour
			SCORE_2: 6 * 60, // 6 hours
			SCORE_3: 24 * 60 // 24 hours
		},

		// Risk thresholds in percentage
		RISK: {
			SCORE_1: 15,
			SCORE_2: 30,
			SCORE_3: 50
		},

		// Difficulty thresholds
		DIFFICULTY: {
			SCORE_1: 25,
			SCORE_2: 50,
			SCORE_3: 75
		}
	};

	/**
	 * Expedition status values
	 */
	static readonly STATUS = {
		PENDING: "pending", // Generated but not confirmed
		IN_PROGRESS: "in_progress",
		COMPLETED: "completed",
		RECALLED: "recalled",
		CANCELLED: "cancelled"
	} as const;

	/**
	 * Location types for expeditions
	 * Each location can influence reward types
	 */
	static readonly LOCATION_TYPES = {
		FOREST: "forest",
		MOUNTAIN: "mountain",
		DESERT: "desert",
		SWAMP: "swamp",
		RUINS: "ruins",
		CAVE: "cave",
		PLAINS: "plains",
		COAST: "coast"
	} as const;

	/**
	 * Reward type weights by location
	 * Higher weight = higher chance of getting that reward type
	 */
	static readonly LOCATION_REWARD_WEIGHTS: Record<string, Record<string, number>> = {
		forest: {
			money: 1, gems: 0.5, experience: 1.5, guildExperience: 1, points: 1
		},
		mountain: {
			money: 1.5, gems: 1.5, experience: 1, guildExperience: 0.5, points: 1
		},
		desert: {
			money: 2, gems: 0.5, experience: 0.5, guildExperience: 1, points: 1.5
		},
		swamp: {
			money: 0.5, gems: 0.5, experience: 1, guildExperience: 1.5, points: 1.5
		},
		ruins: {
			money: 1, gems: 2, experience: 1, guildExperience: 1, points: 0.5
		},
		cave: {
			money: 1.5, gems: 1.5, experience: 0.5, guildExperience: 1, points: 1
		},
		plains: {
			money: 1, gems: 0.5, experience: 1.5, guildExperience: 1.5, points: 1
		},
		coast: {
			money: 1, gems: 1, experience: 1, guildExperience: 1, points: 1.5
		}
	};

	/**
	 * Talisman small event constants
	 */
	static readonly TALISMAN_EVENT = {
		MIN_LEVEL: 20,
		BONUS_IF_PET_IN_EXPEDITION: {
			MONEY_MIN: 50,
			MONEY_MAX: 150,
			EXPERIENCE_MIN: 25,
			EXPERIENCE_MAX: 75
		}
	};
}

export type ExpeditionStatus = (typeof ExpeditionConstants.STATUS)[keyof typeof ExpeditionConstants.STATUS];
export type ExpeditionLocationType = (typeof ExpeditionConstants.LOCATION_TYPES)[keyof typeof ExpeditionConstants.LOCATION_TYPES];
