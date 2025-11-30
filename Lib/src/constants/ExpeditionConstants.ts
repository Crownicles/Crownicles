/**
 * Constants for the Pet Expedition system
 * Players can send their pet on expeditions to earn rewards based on duration, risk, and difficulty
 */
export abstract class ExpeditionConstants {
	/**
	 * Time conversion constants
	 */
	static readonly TIME = {
		MINUTES_PER_HOUR: 60,
		HOURS_PER_DAY: 24
	};

	/**
	 * Duration limits for expeditions (in minutes)
	 */
	static readonly DURATION = {
		MIN_MINUTES: 10,
		MAX_MINUTES: 3 * ExpeditionConstants.TIME.HOURS_PER_DAY * ExpeditionConstants.TIME.MINUTES_PER_HOUR // 3 days in minutes
	};

	/**
	 * Risk rate categories for display purposes
	 * Risk rate is a percentage from 0 to 100
	 * 5 categories: veryLow (0-15), low (16-30), medium (31-50), high (51-70), veryHigh (71+)
	 */
	static readonly RISK_DISPLAY_CATEGORIES = {
		VERY_LOW: {
			MAX: 15,
			NAME: "veryLow"
		},
		LOW: {
			MAX: 30,
			NAME: "low"
		},
		MEDIUM: {
			MAX: 50,
			NAME: "medium"
		},
		HIGH: {
			MAX: 70,
			NAME: "high"
		},
		VERY_HIGH: {
			MAX: 100,
			NAME: "veryHigh"
		}
	};

	/**
	 * Wealth rate categories for display purposes
	 * Wealth rate is a multiplier from 0.0 to 2.0
	 * 4 categories: poor (0-0.5), modest (0.51-1.0), rich (1.01-1.5), legendary (1.51+)
	 */
	static readonly WEALTH_DISPLAY_CATEGORIES = {
		POOR: {
			MAX: 0.5,
			NAME: "poor"
		},
		MODEST: {
			MAX: 1.0,
			NAME: "modest"
		},
		RICH: {
			MAX: 1.5,
			NAME: "rich"
		},
		LEGENDARY: {
			MAX: 2.0,
			NAME: "legendary"
		}
	};

	/**
	 * Reward index categories for display purposes
	 * Reward index is a value from 0 to 9 based on duration, risk, and difficulty scores
	 * 5 categories: meager (0-1), modest (2-3), substantial (4-5), bountiful (6-7), legendary (8-9)
	 */
	static readonly REWARD_DISPLAY_CATEGORIES = {
		MEAGER: {
			MAX: 1,
			NAME: "meager"
		},
		MODEST: {
			MAX: 3,
			NAME: "modest"
		},
		SUBSTANTIAL: {
			MAX: 5,
			NAME: "substantial"
		},
		BOUNTIFUL: {
			MAX: 7,
			NAME: "bountiful"
		},
		LEGENDARY: {
			MAX: 9,
			NAME: "legendary"
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
	 * Difficulty categories for display purposes
	 * Difficulty is a value from 0 to 100
	 * 5 categories: trivial (0-20), easy (21-40), moderate (41-60), challenging (61-80), treacherous (81+)
	 */
	static readonly DIFFICULTY_DISPLAY_CATEGORIES = {
		TRIVIAL: {
			MAX: 20,
			NAME: "trivial"
		},
		EASY: {
			MAX: 40,
			NAME: "easy"
		},
		MODERATE: {
			MAX: 60,
			NAME: "moderate"
		},
		CHALLENGING: {
			MAX: 80,
			NAME: "challenging"
		},
		TREACHEROUS: {
			MAX: 100,
			NAME: "treacherous"
		}
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
		CANCEL_BEFORE_DEPARTURE_BASE: -15,
		RECALL_DURING_EXPEDITION: -25,
		TOTAL_FAILURE: -10,
		TOTAL_SUCCESS: 5
	};

	/**
	 * Progressive penalty for cancellation
	 * Love lost = base * (1 + cancellations in last 7 days)
	 */
	static readonly CANCELLATION_PENALTY = {
		/**
		 * Number of days to look back for cancellation history
		 */
		LOOKBACK_DAYS: 7
	};

	/**
	 * Random item reward configuration
	 * minRarity = max(1, rewardIndex - 3)
	 * maxRarity depends on reward index:
	 * - rewardIndex = 1: maxRarity = 5 (SPECIAL)
	 * - rewardIndex = 2: maxRarity = 6 (EPIC)
	 * - rewardIndex = 3: maxRarity = 7 (LEGENDARY)
	 * - rewardIndex >= 4: maxRarity = 8 (MYTHICAL)
	 */
	static readonly ITEM_REWARD = {
		MIN_RARITY_OFFSET: 3,
		MIN_RARITY_FLOOR: 1,
		MAX_RARITY_BY_REWARD_INDEX: [5, 5, 6, 7, 8, 8, 8, 8, 8, 8] as const
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
	static readonly NO_FOOD_RISK_MULTIPLIER = 3;

	/**
	 * Pet speed impact on expedition duration
	 * Speed ranges from 0 to 30
	 * At speed 30: duration reduced by 30% (multiplier = 0.70)
	 * At speed 0: duration increased by 20% (multiplier = 1.20)
	 * Linear interpolation between these values
	 */
	static readonly SPEED_DURATION_MODIFIER = {
		MIN_SPEED: 0,
		MAX_SPEED: 30,

		/** Duration multiplier at max speed (30% reduction) */
		MAX_SPEED_MULTIPLIER: 0.70,

		/** Duration multiplier at min speed (20% increase) */
		MIN_SPEED_MULTIPLIER: 1.20
	};

	/**
	 * Constants for expedition ID generation
	 */
	static readonly ID_GENERATION = {
		RANDOM_MIN: 1000,
		RANDOM_MAX: 9999,
		PREFIX: "exp"
	};

	/**
	 * Percentage/decimal conversion constants
	 */
	static readonly PERCENTAGE = {
		MAX: 100,
		DECIMAL_PRECISION: 100
	};

	/**
	 * Fallback gem to money conversion rate when gem system is unavailable
	 */
	static readonly GEM_TO_MONEY_FALLBACK_RATE = 50;

	/**
	 * Number of expeditions proposed to the player
	 */
	static readonly EXPEDITIONS_PROPOSED: 3;

	/**
	 * Reward tables (10 slots each, index 0-9)
	 * Index is calculated from: duration_score + risk_score + difficulty_score (each 0-3)
	 */
	static readonly REWARD_TABLES = {
		/**
		 * Money rewards ranging from 100 to 5000
		 */
		MONEY: [
			100,
			250,
			500,
			850,
			1300,
			1900,
			2600,
			3400,
			4200,
			5000
		],
		/**
		 * Experience rewards ranging from 50 to 3500
		 */
		EXPERIENCE: [
			50,
			150,
			350,
			600,
			950,
			1400,
			1950,
			2550,
			3000,
			3500
		],
		/**
		 * Score/points rewards ranging from 75 to 2000
		 */
		POINTS: [
			75,
			175,
			325,
			525,
			775,
			1075,
			1400,
			1700,
			1875,
			2000
		]
	};

	/**
	 * Food consumption table (10 slots, index 0-9)
	 * Higher index = more food required
	 */
	static readonly FOOD_CONSUMPTION = [
		1,
		2,
		3,
		4,
		6,
		7,
		8,
		10,
		15,
		25
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
	 * Higher weight = higher multiplier for that reward type
	 */
	static readonly LOCATION_REWARD_WEIGHTS: Record<string, Record<string, number>> = {
		forest: {
			money: 1, experience: 1.5, points: 1
		},
		mountain: {
			money: 1.5, experience: 1, points: 1
		},
		desert: {
			money: 2, experience: 0.5, points: 1.5
		},
		swamp: {
			money: 0.5, experience: 1, points: 1.5
		},
		ruins: {
			money: 1, experience: 1, points: 0.5
		},
		cave: {
			money: 1.5, experience: 0.5, points: 1
		},
		plains: {
			money: 1, experience: 1.5, points: 1
		},
		coast: {
			money: 1, experience: 1, points: 1.5
		}
	};

	/**
	 * Talisman small event constants
	 */
	static readonly TALISMAN_EVENT = {
		/**
		 * Minimum level to encounter the event
		 */
		MIN_LEVEL: 20,

		/**
		 * Minimum level to receive the talisman
		 */
		TALISMAN_MIN_LEVEL: 30,

		/**
		 * Number of encounters for talisman introduction phase
		 */
		TALISMAN_INTRO_ENCOUNTERS: 5,

		/**
		 * Number of encounters for expedition explanation phase
		 */
		EXPEDITION_EXPLANATION_ENCOUNTERS: 5,

		/**
		 * Total encounters needed before talisman can be given (intro + explanation)
		 */
		TOTAL_ENCOUNTERS_BEFORE_TALISMAN: 10,

		/**
		 * Bonus rewards when pet is in expedition
		 */
		BONUS_IF_PET_IN_EXPEDITION: {
			MONEY_MIN: 50,
			MONEY_MAX: 150,
			EXPERIENCE_MIN: 25,
			EXPERIENCE_MAX: 75
		}
	};

	/**
	 * Clone talisman drop constants
	 * The clone talisman can only be found during successful expeditions
	 * Chance increases with expedition difficulty and duration
	 */
	static readonly CLONE_TALISMAN = {
		/**
		 * Base drop chance (percentage, e.g., 0.5 = 0.5%)
		 */
		BASE_DROP_CHANCE: 0.5,

		/**
		 * Bonus drop chance per reward index point (0-9)
		 * At max reward index (9), this adds 4.5% to base chance
		 */
		REWARD_INDEX_BONUS_PER_POINT: 0.5,

		/**
		 * Locations with bonus drop chance for the clone talisman
		 */
		BONUS_LOCATIONS: ["ruins", "cave"] as const,

		/**
		 * Bonus multiplier for special locations
		 */
		LOCATION_BONUS_MULTIPLIER: 1.5
	};

	/**
	 * Badge constants for expedition achievements
	 */
	static readonly BADGE = {
		/**
		 * Number of successful expeditions required to earn the expert expediteur badge
		 */
		EXPERT_EXPEDITEUR_THRESHOLD: 150
	};

	/**
	 * Emoji mapping for location types
	 */
	static readonly LOCATION_EMOJIS: Record<ExpeditionLocationType, string> = {
		forest: "🌲",
		mountain: "⛰️",
		desert: "🏜️",
		swamp: "🌿",
		ruins: "🏛️",
		cave: "🕳️",
		plains: "🌾",
		coast: "🌊"
	};

	/**
	 * Get the risk category name based on risk rate value
	 * @param riskRate - Risk rate percentage (0-100)
	 * @returns The category name key for translations
	 */
	static getRiskCategoryName(riskRate: number): string {
		if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.VERY_LOW.MAX) {
			return ExpeditionConstants.RISK_DISPLAY_CATEGORIES.VERY_LOW.NAME;
		}
		if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.LOW.MAX) {
			return ExpeditionConstants.RISK_DISPLAY_CATEGORIES.LOW.NAME;
		}
		if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.MEDIUM.MAX) {
			return ExpeditionConstants.RISK_DISPLAY_CATEGORIES.MEDIUM.NAME;
		}
		if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.HIGH.MAX) {
			return ExpeditionConstants.RISK_DISPLAY_CATEGORIES.HIGH.NAME;
		}
		return ExpeditionConstants.RISK_DISPLAY_CATEGORIES.VERY_HIGH.NAME;
	}

	/**
	 * Get the difficulty category name based on difficulty value
	 * @param difficulty - Difficulty value (0-100)
	 * @returns The category name key for translations
	 */
	static getDifficultyCategoryName(difficulty: number): string {
		if (difficulty <= ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.TRIVIAL.MAX) {
			return ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.TRIVIAL.NAME;
		}
		if (difficulty <= ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.EASY.MAX) {
			return ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.EASY.NAME;
		}
		if (difficulty <= ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.MODERATE.MAX) {
			return ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.MODERATE.NAME;
		}
		if (difficulty <= ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.CHALLENGING.MAX) {
			return ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.CHALLENGING.NAME;
		}
		return ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES.TREACHEROUS.NAME;
	}

	/**
	 * Get the reward category name based on reward index value
	 * @param rewardIndex - Reward index value (0-9)
	 * @returns The category name key for translations
	 */
	static getRewardCategoryName(rewardIndex: number): string {
		if (rewardIndex <= ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.MEAGER.MAX) {
			return ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.MEAGER.NAME;
		}
		if (rewardIndex <= ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.MODEST.MAX) {
			return ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.MODEST.NAME;
		}
		if (rewardIndex <= ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.SUBSTANTIAL.MAX) {
			return ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.SUBSTANTIAL.NAME;
		}
		if (rewardIndex <= ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.BOUNTIFUL.MAX) {
			return ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.BOUNTIFUL.NAME;
		}
		return ExpeditionConstants.REWARD_DISPLAY_CATEGORIES.LEGENDARY.NAME;
	}

	/**
	 * Get the emoji for a location type
	 * @param locationType - The expedition location type
	 * @returns The emoji string for the location
	 */
	static getLocationEmoji(locationType: ExpeditionLocationType): string {
		return ExpeditionConstants.LOCATION_EMOJIS[locationType] ?? "🗺️";
	}

	/**
	 * Duration ranges for each expedition slot
	 * Slot 0 (SHORT): Quick expeditions (10 min - 1 hour)
	 * Slot 1 (MEDIUM): Standard expeditions (15 min - 10 hours)
	 * Slot 2 (LONG): Distant expeditions (12 hours - 3 days)
	 */
	static readonly DURATION_RANGES = {
		SHORT: {
			MIN: 10,
			MAX: 60
		},
		MEDIUM: {
			MIN: 15,
			MAX: 10 * ExpeditionConstants.TIME.MINUTES_PER_HOUR
		},
		LONG: {
			MIN: 12 * ExpeditionConstants.TIME.MINUTES_PER_HOUR,
			MAX: 3 * ExpeditionConstants.TIME.HOURS_PER_DAY * ExpeditionConstants.TIME.MINUTES_PER_HOUR
		}
	};

	/**
	 * Get duration range as array for indexed access
	 * @returns Array of duration ranges [SHORT, MEDIUM, LONG]
	 */
	static getDurationRangesArray(): Array<{
		min: number;
		max: number;
	}> {
		return [
			{
				min: ExpeditionConstants.DURATION_RANGES.SHORT.MIN,
				max: ExpeditionConstants.DURATION_RANGES.SHORT.MAX
			},
			{
				min: ExpeditionConstants.DURATION_RANGES.MEDIUM.MIN,
				max: ExpeditionConstants.DURATION_RANGES.MEDIUM.MAX
			},
			{
				min: ExpeditionConstants.DURATION_RANGES.LONG.MIN,
				max: ExpeditionConstants.DURATION_RANGES.LONG.MAX
			}
		];
	}
}

export type ExpeditionStatus = (typeof ExpeditionConstants.STATUS)[keyof typeof ExpeditionConstants.STATUS];
export type ExpeditionLocationType = (typeof ExpeditionConstants.LOCATION_TYPES)[keyof typeof ExpeditionConstants.LOCATION_TYPES];
