import {
	daysToMinutes, hoursToMinutes
} from "../utils/TimeUtils";

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
		MAX_MINUTES: daysToMinutes(3)
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
	 * Default food cost when not specified
	 */
	static readonly DEFAULT_FOOD_COST = 1;

	/**
	 * Score range for each component (duration, risk, difficulty)
	 * Each component is scored from 0 to 3, sum gives reward index 0-9
	 */
	static readonly COMPONENT_SCORE = {
		MIN: 0,
		MAX: 3
	};

	/**
	 * Map location ID used when no location exists (e.g., cancelled before departure)
	 */
	static readonly NO_MAP_LOCATION = 0;

	/**
	 * Default map location ID when not specified
	 */
	static readonly DEFAULT_MAP_LOCATION_ID = 1;

	/**
	 * Default map type code when not specified
	 */
	static readonly DEFAULT_MAP_TYPE = "ro";

	/**
	 * Number of local expeditions generated (based on player's current map link)
	 */
	static readonly LOCAL_EXPEDITIONS_COUNT = 2;

	/**
	 * Value indicating no bonus expedition is selected
	 */
	static readonly NO_BONUS_EXPEDITION = -1;

	/**
	 * Total number of expeditions proposed (local + distant)
	 */
	static readonly TOTAL_EXPEDITIONS_COUNT = 3;

	/**
	 * Rounding factor for display duration (rounds to nearest 10 minutes)
	 */
	static readonly DURATION_DISPLAY_ROUNDING = 10;

	/**
	 * Mapping from map location types to expedition location types
	 */
	static readonly MAP_TYPE_TO_EXPEDITION_TYPE: Record<string, ExpeditionLocationType> = {
		fo: "forest",
		mo: "mountain",
		de: "desert",
		ruins: "ruins",
		be: "coast",
		ri: "coast",
		la: "swamp",
		pl: "plains",
		ro: "plains",
		vi: "plains",
		ci: "cave",
		castleEntrance: "ruins",
		castleThrone: "ruins",
		continent: "plains"
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
		MIN_LOVE_POINTS: 20,
		MIN_LEVEL_FOR_TALISMAN: 20
	};

	/**
	 * Duration of pet fatigue after completing an expedition (in milliseconds)
	 * Pet cannot start a new expedition during this time (unless daily exemption applies)
	 */
	static readonly FATIGUE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

	/**
	 * Number of expeditions per day that don't trigger fatigue
	 * The first N completed expeditions of the day won't make the pet tired
	 */
	static readonly FATIGUE_FREE_DAILY_EXPEDITIONS = 2;

	/**
	 * Love points changes during expedition lifecycle
	 */
	static readonly LOVE_CHANGES = {
		CANCEL_BEFORE_DEPARTURE_BASE: -15,
		RECALL_DURING_EXPEDITION: -25,
		TOTAL_FAILURE: -3,
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
	 * Safety caps used during expedition penalty calculations
	 */
	static readonly CAPS = {
		/** Maximum cumulative love points that can be lost due to repeated cancellations/recalls */
		MAX_CANCELLATION_LOVE_LOSS: 60
	};

	/**
	 * Random item reward configuration
	 * minRarity = max(1, rewardIndex - 4)
	 * maxRarity depends on reward index:
	 * - rewardIndex = 1: maxRarity = 5 (SPECIAL)
	 * - rewardIndex = 2: maxRarity = 6 (EPIC)
	 * - rewardIndex = 3: maxRarity = 7 (LEGENDARY)
	 * - rewardIndex >= 4: maxRarity = 8 (MYTHICAL)
	 */
	static readonly ITEM_REWARD = {
		MIN_RARITY_OFFSET: 4,
		MIN_RARITY_FLOOR: 1,
		MAX_RARITY_BY_REWARD_INDEX: [
			5,
			5,
			6,
			7,
			8,
			8,
			8,
			8,
			8,
			8
		] as const
	};

	/**
	 * Formula coefficients for effective risk calculation
	 * effective_risk = initial_risk + (difficulty / DIFFICULTY_DIVISOR) - pet_force - (love / LOVE_DIVISOR)
	 */
	static readonly EFFECTIVE_RISK_FORMULA = {
		DIFFICULTY_DIVISOR: 4,
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
	 * Formula: BASE_MULTIPLIER - petSpeed * REDUCTION_PER_SPEED_POINT
	 */
	static readonly SPEED_DURATION_MODIFIER = {
		/** Duration multiplier at speed 0 (20% increase) */
		BASE_MULTIPLIER: 1.20,

		/** Duration reduction per speed point: (1.20 - 0.70) / 30 */
		REDUCTION_PER_SPEED_POINT: 0.5 / 30
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
			50,
			120,
			235,
			435,
			710,
			1300,
			2100,
			3200,
			4200,
			5000
		],

		/**
		 * Experience rewards ranging from 35 to 2450 (reduced by 30%)
		 */
		EXPERIENCE: [
			35,
			105,
			245,
			420,
			665,
			980,
			1365,
			1785,
			2100,
			2450
		],

		/**
		 * Score/points rewards ranging from 6 to 710
		 */
		POINTS: [
			6,
			20,
			75,
			145,
			210,
			340,
			420,
			585,
			650,
			710
		]
	};

	/**
	 * Food consumption table (10 slots, index 0-9)
	 * Higher index = more food required
	 */
	static readonly FOOD_CONSUMPTION = [
		1,
		3,
		5,
		6,
		8,
		10,
		12,
		15,
		25,
		32
	];

	/**
	 * Error codes for expedition operations
	 */
	static readonly ERROR_CODES = {
		NO_PET: "noPet",
		NO_EXPEDITION: "noExpedition",
		EXPEDITION_NOT_COMPLETE: "expeditionNotComplete",
		INVALID_STATE: "invalidState",
		EXPEDITION_IN_PROGRESS: "expeditionInProgress",
		NO_TALISMAN: "noTalisman",
		INSUFFICIENT_LOVE: "insufficientLove",
		PET_HUNGRY: "petHungry",
		NOT_ON_CONTINENT: "notOnContinent"
	} as const;

	/**
	 * Insufficient food cause codes
	 */
	static readonly INSUFFICIENT_FOOD_CAUSES = {
		NO_GUILD: "noGuild",
		GUILD_NO_FOOD: "guildNoFood"
	} as const;

	/**
	 * Wealth rate bonus/malus percentage applied to reward index
	 * At wealthRate=0: -30% on reward index
	 * At wealthRate=1: no change
	 * At wealthRate=2: +30% on reward index
	 */
	static readonly WEALTH_RATE_REWARD_INDEX_BONUS = 0.30;

	/**
	 * Neutral wealth rate value (no bonus/malus)
	 */
	static readonly NEUTRAL_WEALTH_RATE = 1;

	/**
	 * Reward index calculation constants
	 */
	static readonly REWARD_INDEX = {
		/** Minimum reward index value */
		MIN: 0,

		/** Maximum reward index value */
		MAX: 9,

		/** Duration score weight multiplier (duration counts 3x more than risk/difficulty) */
		DURATION_WEIGHT: 3,

		/** Base offset applied to calculated index to balance rewards */
		BASE_OFFSET: 2
	};

	/**
	 * Divisor applied to all rewards on partial success (halves rewards)
	 */
	static readonly PARTIAL_SUCCESS_PENALTY_DIVISOR = 2;

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
	 * Log action values for expedition tracking
	 */
	static readonly LOG_ACTION = {
		START: "start",
		COMPLETE: "complete",
		CANCEL: "cancel",
		RECALL: "recall"
	} as const;

	/**
	 * Location types for expeditions
	 * Each location can influence reward types
	 */
	static readonly EXPEDITION_LOCATION_TYPES = {
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
	static readonly LOCATION_REWARD_WEIGHTS: Record<(typeof ExpeditionConstants.EXPEDITION_LOCATION_TYPES)[keyof typeof ExpeditionConstants.EXPEDITION_LOCATION_TYPES], RewardWeights> = {
		forest: {
			money: 0.8, experience: 1.3, points: 0.9
		},
		mountain: {
			money: 1.9, experience: 1, points: 0.3
		},
		desert: {
			money: 0.6, experience: 0.4, points: 1.5
		},
		swamp: {
			money: 0.4, experience: 1, points: 1.6
		},
		ruins: {
			money: 1.7, experience: 1, points: 0.5
		},
		cave: {
			money: 2.2, experience: 0.5, points: 0.2
		},
		plains: {
			money: 1, experience: 1, points: 1
		},
		coast: {
			money: 1.2, experience: 0.7, points: 0.8
		}
	};

	/**
	 * Terrain difficulty configuration for risk generation
	 * Each terrain has a skew factor that biases the probability distribution
	 * All terrains can generate risk values from 0 to 100, but with different probabilities
	 * skewFactor: Controls the probability bias (0.3 to 3.0)
	 * Values below 1: Biases toward lower risk (safer terrain)
	 * Value equal to 1: Uniform distribution (neutral)
	 * Values above 1: Biases toward higher risk (dangerous terrain)
	 * The formula uses power transformation: risk = 100 * random^skewFactor
	 */
	static readonly TERRAIN_DIFFICULTY: Record<ExpeditionLocationType, TerrainDifficultyConfig> = {
		plains: { skewFactor: 0.5 },
		coast: { skewFactor: 0.65 },
		forest: { skewFactor: 0.75 },
		desert: { skewFactor: 1.0 },
		mountain: { skewFactor: 1.2 },
		swamp: { skewFactor: 1.4 },
		ruins: { skewFactor: 1.6 },
		cave: { skewFactor: 1.8 }
	};

	/**
	 * Talisman small event constants
	 */
	static readonly TALISMAN_EVENT = {
		/**
		 * Minimum level to receive the talisman
		 */
		TALISMAN_MIN_LEVEL: 30,

		/**
		 * Number of encounters for talisman introduction phase (shows intro texts in order)
		 */
		TALISMAN_INTRO_ENCOUNTERS: 2,

		/**
		 * Number of tokens given as consolation when player level is too low
		 */
		LEVEL_TOO_LOW_TOKEN_COMPENSATION: 1,

		/**
		 * Bonus rewards when pet is in expedition (Velanna's rewards)
		 * Always gives bonus points, plus one of the following based on a single random roll:
		 * - 0-4% (5%): random item
		 * - 5-14% (10%): money
		 * - 15-49% (35%): combat potion
		 * - 50-99% (50%): points only
		 */
		BONUS_IF_PET_IN_EXPEDITION: {
			POINTS_MIN: 1,
			POINTS_MAX: 40,

			/** Threshold for item reward (0 to ITEM_THRESHOLD - 1) */
			ITEM_THRESHOLD: 5,

			/** Threshold for money reward (ITEM_THRESHOLD to MONEY_THRESHOLD - 1) */
			MONEY_THRESHOLD: 15,

			/** Threshold for combat potion (MONEY_THRESHOLD to POTION_THRESHOLD - 1) */
			POTION_THRESHOLD: 50,

			/** Above POTION_THRESHOLD: points only */
			COMBAT_POTION_MIN_RARITY: 4,
			COMBAT_POTION_MAX_RARITY: 7,
			MONEY_MIN: 60,
			MONEY_MAX: 110
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
		 * Chance for an expedition to have the bonus clone talisman tag (1 in 20)
		 * Only applied when the player does not already have the clone talisman
		 */
		BONUS_EXPEDITION_CHANCE: 20,

		/**
		 * Multiplier applied to clone talisman drop chance when expedition has the bonus tag
		 */
		BONUS_EXPEDITION_MULTIPLIER: 10
	};

	/**
	 * Bonus tokens constants
	 * A rare bonus that can be applied to expeditions (mutually exclusive with clone talisman bonus)
	 */
	static readonly BONUS_TOKENS = {
		/**
		 * Chance for an expedition to have the bonus tokens multiplier (1 in 50)
		 */
		TOKEN_BONUS_EXPEDITION_CHANCE: 8,

		/**
		 * Multiplier applied to tokens when expedition has the bonus tag
		 */
		MULTIPLIER: 3,

		/**
		 * Minimum tokens guaranteed from any expedition
		 */
		MIN_TOKEN_REWARD: 1,

		/**
		 * Minimum tokens guaranteed when the expedition has the bonus multiplier
		 */
		MIN_BONUS_TOKEN_REWARD: 2,

		/**
		 * Random boost range applied to all expeditions (minimum inclusive)
		 */
		RANDOM_BOOST_MIN: 0,

		/**
		 * Random boost range applied to all expeditions (maximum inclusive)
		 */
		RANDOM_BOOST_MAX: 2
	};

	/**
	 * Badge constants for expedition achievements
	 */
	static readonly BADGE = {
		/**
		 * Number of successful expeditions required to earn the expert expediteur badge
		 */
		EXPERT_EXPEDITEUR_THRESHOLD: 550
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
	 * Duration ranges for each expedition slot
	 * Slot 0 (SHORT): Quick expeditions (10 min - 1 hour)
	 * Slot 1 (MEDIUM): Standard expeditions (15 min - 10 hours)
	 * Slot 2 (LONG): Distant expeditions (12 hours - 3 days)
	 */
	static readonly DURATION_RANGES = {
		SHORT: {
			MIN: 10,
			MAX: hoursToMinutes(1)
		},
		MEDIUM: {
			MIN: 15,
			MAX: hoursToMinutes(10)
		},
		LONG: {
			MIN: hoursToMinutes(12),
			MAX: daysToMinutes(3)
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

	/**
	 * Speed categories for expedition duration comparison
	 * Used to determine if the pet was faster or slower than expected
	 */
	static readonly SPEED_CATEGORIES = {
		VERY_FAST: "veryFast",
		FAST: "fast",
		NORMAL: "normal",
		SLOW: "slow",
		VERY_SLOW: "verySlow"
	} as const;
}

/**
 * Pet expedition preference type
 */
export type PetExpeditionPreference = "liked" | "neutral" | "disliked";

/**
 * Pet expedition preference configuration
 */
export interface PetExpeditionPreferenceConfig {
	liked: ExpeditionLocationType[];
	disliked: ExpeditionLocationType[];
}

/**
 * Reward multipliers based on pet preference for expedition location
 */
export const PET_PREFERENCE_REWARD_MULTIPLIERS: Record<PetExpeditionPreference, number> = {
	liked: 1,
	neutral: 0.8,
	disliked: 0.25
};

/**
 * Additional failure risk for disliked expeditions shorter than 12 hours
 */
export const DISLIKED_SHORT_EXPEDITION_FAILURE_BONUS = 10;

/**
 * Threshold duration in minutes below which disliked expeditions have extra failure risk
 */
export const DISLIKED_EXPEDITION_DURATION_THRESHOLD_MINUTES = 720; // 12 hours

/**
 * Pet expedition preferences by pet type ID
 * Each pet has preferred (liked) and disliked expedition location types
 * Locations not in either list are considered neutral
 *
 * Categories:
 * - Canines (dogs, wolves, foxes): like forests, plains | dislike deserts, swamps
 * - Felines (cats, lions, tigers): like ruins, plains | dislike swamps, coasts
 * - Birds: like mountains, forests | dislike caves, swamps
 * - Rodents: like plains, caves | dislike mountains, coasts
 * - Reptiles: like deserts, swamps | dislike mountains, coasts
 * - Aquatic: like coasts, swamps | dislike deserts, mountains
 * - Bears: like caves, mountains | dislike deserts, coasts
 * - Primates: like forests, ruins | dislike deserts, caves
 * - Equines: like plains, mountains | dislike swamps, caves
 * - Farm animals: like plains, forests | dislike mountains, caves
 * - Mythical/Special: balanced preferences
 */
export const PET_EXPEDITION_PREFERENCES: Record<number, PetExpeditionPreferenceConfig> = {
	// 0 - No pet (default neutral)
	0: {
		liked: [], disliked: []
	},

	// Canines - Dogs, wolves, foxes (like forests/plains, dislike deserts/swamps)
	1: {
		liked: ["forest", "plains"], disliked: ["desert", "swamp"]
	}, // Dog
	2: {
		liked: ["forest", "plains"], disliked: ["desert", "swamp"]
	}, // Poodle
	20: {
		liked: ["forest", "plains"], disliked: ["desert", "cave"]
	}, // Fox
	28: {
		liked: ["forest", "mountain"], disliked: ["desert", "swamp"]
	}, // Wolf

	// Felines - Cats, lions, tigers (like ruins/plains, dislike swamps/coasts)
	3: {
		liked: ["ruins", "plains"], disliked: ["swamp", "coast"]
	}, // Cat
	4: {
		liked: ["ruins", "cave"], disliked: ["swamp", "coast"]
	}, // Black cat
	56: {
		liked: ["forest", "plains"], disliked: ["swamp", "coast"]
	}, // Tiger
	57: {
		liked: ["plains", "desert"], disliked: ["swamp", "cave"]
	}, // Lion
	60: {
		liked: ["forest", "mountain"], disliked: ["swamp", "coast"]
	}, // Leopard

	// Rodents - Mice, hamsters, rabbits (like plains/caves, dislike mountains/coasts)
	5: {
		liked: ["plains", "cave"], disliked: ["mountain", "coast"]
	}, // Mouse
	6: {
		liked: ["plains", "cave"], disliked: ["mountain", "coast"]
	}, // Hamster
	7: {
		liked: ["plains", "forest"], disliked: ["cave", "desert"]
	}, // Rabbit
	35: {
		liked: ["forest", "ruins"], disliked: ["desert", "coast"]
	}, // Raccoon
	40: {
		liked: ["forest", "plains"], disliked: ["desert", "coast"]
	}, // Chipmunk
	41: {
		liked: ["forest", "plains"], disliked: ["desert", "cave"]
	}, // Hedgehog
	93: {
		liked: ["ruins", "cave"], disliked: ["forest", "coast"]
	}, // Rat

	// Farm animals - Cows, pigs, sheep (like plains/forests, dislike mountains/caves)
	8: {
		liked: ["plains", "forest"], disliked: ["mountain", "cave"]
	}, // Cow
	9: {
		liked: ["plains", "forest"], disliked: ["mountain", "desert"]
	}, // Pig
	17: {
		liked: ["plains", "mountain"], disliked: ["swamp", "cave"]
	}, // Sheep
	18: {
		liked: ["mountain", "plains"], disliked: ["swamp", "cave"]
	}, // Goat
	96: {
		liked: ["plains", "desert"], disliked: ["swamp", "cave"]
	}, // Donkey

	// Poultry - Chickens, ducks, geese (like plains/forests, dislike mountains/caves)
	10: {
		liked: ["plains", "forest"], disliked: ["mountain", "cave"]
	}, // Chicken
	12: {
		liked: ["coast", "plains"], disliked: ["mountain", "cave"]
	}, // Duck
	19: {
		liked: ["plains", "forest"], disliked: ["mountain", "cave"]
	}, // Turkey
	92: {
		liked: ["plains", "forest"], disliked: ["mountain", "cave"]
	}, // Chick
	97: {
		liked: ["plains", "coast"], disliked: ["mountain", "cave"]
	}, // Goose

	// Birds - Various flying birds (like mountains/forests, dislike caves/swamps)
	11: {
		liked: ["mountain", "forest"], disliked: ["cave", "swamp"]
	}, // Bird
	26: {
		liked: ["forest", "ruins"], disliked: ["cave", "desert"]
	}, // Owl
	27: {
		liked: ["cave", "ruins"], disliked: ["plains", "coast"]
	}, // Bat
	33: {
		liked: ["coast", "plains"], disliked: ["cave", "desert"]
	}, // Swan
	34: {
		liked: ["coast", "swamp"], disliked: ["cave", "mountain"]
	}, // Flamingo
	53: {
		liked: ["forest", "plains"], disliked: ["cave", "desert"]
	}, // Peacock
	54: {
		liked: ["forest", "plains"], disliked: ["cave", "desert"]
	}, // Parrot
	58: {
		liked: ["mountain", "plains"], disliked: ["cave", "swamp"]
	}, // Eagle
	62: {
		liked: ["plains", "forest"], disliked: ["cave", "swamp"]
	}, // Dove
	94: {
		liked: ["forest", "plains"], disliked: ["cave", "desert"]
	}, // Blackbird
	95: {
		liked: ["ruins", "forest"], disliked: ["coast", "swamp"]
	}, // Crow
	59: {
		liked: ["forest", "plains"], disliked: ["mountain", "cave"]
	}, // Dodo

	// Equines - Horses, zebras (like plains/mountains, dislike swamps/caves)
	13: {
		liked: ["plains", "mountain"], disliked: ["swamp", "cave"]
	}, // Horse
	47: {
		liked: ["plains", "desert"], disliked: ["swamp", "cave"]
	}, // Zebra
	98: {
		liked: ["forest", "mountain"], disliked: ["swamp", "desert"]
	}, // Elk

	// Reptiles - Snakes, lizards, turtles (like deserts/swamps, dislike mountains/coasts)
	14: {
		liked: ["coast", "swamp"], disliked: ["mountain", "desert"]
	}, // Turtle
	15: {
		liked: ["desert", "swamp"], disliked: ["mountain", "coast"]
	}, // Snake
	16: {
		liked: ["desert", "ruins"], disliked: ["mountain", "coast"]
	}, // Lizard
	44: {
		liked: ["desert", "cave"], disliked: ["coast", "forest"]
	}, // Scorpion
	45: {
		liked: ["swamp", "coast"], disliked: ["mountain", "desert"]
	}, // Crocodile

	// Bears (like caves/mountains, dislike deserts/coasts)
	21: {
		liked: ["cave", "mountain"], disliked: ["desert", "coast"]
	}, // Bear
	42: {
		liked: ["mountain", "coast"], disliked: ["desert", "swamp"]
	}, // Polar bear
	43: {
		liked: ["forest", "mountain"], disliked: ["desert", "coast"]
	}, // Panda

	// Amphibians (like swamps/coasts, dislike deserts/mountains)
	23: {
		liked: ["swamp", "coast"], disliked: ["desert", "mountain"]
	}, // Frog

	// Primates - Monkeys, apes (like forests/ruins, dislike deserts/caves)
	24: {
		liked: ["forest", "ruins"], disliked: ["desert", "cave"]
	}, // Monkey
	90: {
		liked: ["forest", "swamp"], disliked: ["desert", "mountain"]
	}, // Orangutan
	91: {
		liked: ["forest", "mountain"], disliked: ["desert", "coast"]
	}, // Gorilla

	// Arctic animals (like mountains/coasts, dislike deserts/swamps)
	25: {
		liked: ["coast", "mountain"], disliked: ["desert", "swamp"]
	}, // Penguin
	72: {
		liked: ["coast", "mountain"], disliked: ["desert", "swamp"]
	}, // Penguin (alternative)
	30: {
		liked: ["coast", "cave"], disliked: ["desert", "plains"]
	}, // Seal

	// Australian animals (like plains/deserts, dislike caves/swamps)
	22: {
		liked: ["forest", "plains"], disliked: ["desert", "cave"]
	}, // Koala
	52: {
		liked: ["plains", "desert"], disliked: ["cave", "swamp"]
	}, // Kangaroo

	// African savanna (like plains/deserts, dislike caves/swamps)
	31: {
		liked: ["swamp", "coast"], disliked: ["desert", "mountain"]
	}, // Hippo
	46: {
		liked: ["plains", "forest"], disliked: ["cave", "mountain"]
	}, // Elephant
	48: {
		liked: ["plains", "desert"], disliked: ["cave", "swamp"]
	}, // Rhino
	51: {
		liked: ["plains", "forest"], disliked: ["cave", "swamp"]
	}, // Giraffe

	// Desert animals (like deserts/plains, dislike coasts/swamps)
	29: {
		liked: ["forest", "plains"], disliked: ["desert", "coast"]
	}, // Boar
	32: {
		liked: ["mountain", "desert"], disliked: ["swamp", "coast"]
	}, // Llama
	49: {
		liked: ["desert", "plains"], disliked: ["coast", "swamp"]
	}, // Dromedary
	50: {
		liked: ["desert", "plains"], disliked: ["coast", "swamp"]
	}, // Camel

	// Forest small mammals
	36: {
		liked: ["forest", "plains"], disliked: ["desert", "coast"]
	}, // Skunk
	37: {
		liked: ["forest", "plains"], disliked: ["desert", "coast"]
	}, // Badger
	38: {
		liked: ["forest", "coast"], disliked: ["desert", "mountain"]
	}, // Beaver
	39: {
		liked: ["forest", "swamp"], disliked: ["desert", "mountain"]
	}, // Sloth
	55: {
		liked: ["coast", "forest"], disliked: ["desert", "mountain"]
	}, // Otter
	87: {
		liked: ["forest", "plains"], disliked: ["desert", "cave"]
	}, // Deer
	88: {
		liked: ["plains", "swamp"], disliked: ["desert", "cave"]
	}, // Water buffalo
	89: {
		liked: ["plains", "mountain"], disliked: ["swamp", "cave"]
	}, // Bison

	// Aquatic animals (like coasts/swamps, dislike deserts/mountains)
	71: {
		liked: ["coast", "swamp"], disliked: ["desert", "mountain"]
	}, // Octopus
	73: {
		liked: ["coast", "swamp"], disliked: ["desert", "mountain"]
	}, // Fish
	74: {
		liked: ["coast", "swamp"], disliked: ["desert", "mountain"]
	}, // Tropical fish
	75: {
		liked: ["coast", "swamp"], disliked: ["desert", "mountain"]
	}, // Pufferfish
	76: {
		liked: ["coast", "swamp"], disliked: ["desert", "mountain"]
	}, // Jellyfish
	77: {
		liked: ["coast", "cave"], disliked: ["desert", "mountain"]
	}, // Shark
	78: {
		liked: ["coast", "plains"], disliked: ["desert", "mountain"]
	}, // Whale
	79: {
		liked: ["coast", "plains"], disliked: ["desert", "mountain"]
	}, // Whale
	80: {
		liked: ["coast", "swamp"], disliked: ["desert", "mountain"]
	}, // Shrimp
	81: {
		liked: ["coast", "cave"], disliked: ["desert", "mountain"]
	}, // Lobster
	82: {
		liked: ["coast", "plains"], disliked: ["desert", "cave"]
	}, // Dolphin
	86: {
		liked: ["coast", "swamp"], disliked: ["desert", "mountain"]
	}, // Crab
	85: {
		liked: ["forest", "swamp"], disliked: ["desert", "mountain"]
	}, // Snail

	// Mythical creatures
	61: {
		liked: ["mountain", "plains"], disliked: ["swamp", "cave"]
	}, // Mammoth
	63: {
		liked: ["forest", "plains"], disliked: ["cave", "swamp"]
	}, // Unicorn
	64: {
		liked: ["mountain", "cave"], disliked: ["coast", "swamp"]
	}, // Dragon
	65: {
		liked: ["plains", "forest"], disliked: ["coast", "cave"]
	}, // T-Rex
	83: {
		liked: ["mountain", "desert"], disliked: ["coast", "swamp"]
	}, // Phoenix
	84: {
		liked: ["plains", "forest"], disliked: ["desert", "cave"]
	}, // Diplodocus

	// Special/Seasonal
	66: {
		liked: ["ruins", "coast"], disliked: ["cave", "mountain"]
	}, // Stitch
	67: {
		liked: ["mountain", "plains"], disliked: ["desert", "swamp"]
	}, // Snowman
	68: {
		liked: ["coast", "plains"], disliked: ["mountain", "cave"]
	}, // Scarlet duck
	69: {
		liked: ["mountain", "plains"], disliked: ["desert", "swamp"]
	}, // Snowman
	70: {
		liked: ["ruins", "desert"], disliked: ["forest", "swamp"]
	}, // Alien
	99: {
		liked: ["ruins", "cave"], disliked: ["coast", "plains"]
	}, // Jack-o-lantern
	100: {
		liked: ["ruins", "cave"], disliked: ["plains", "coast"]
	}, // Ghost
	101: {
		liked: ["cave", "ruins"], disliked: ["plains", "coast"]
	} // Vampire
};

/**
 * Get pet expedition preference for a given location type
 */
export function getPetExpeditionPreference(petTypeId: number, locationType: ExpeditionLocationType): PetExpeditionPreference {
	const preferences = PET_EXPEDITION_PREFERENCES[petTypeId];

	if (!preferences) {
		return "neutral";
	}

	if (preferences.liked.includes(locationType)) {
		return "liked";
	}

	if (preferences.disliked.includes(locationType)) {
		return "disliked";
	}

	return "neutral";
}

/**
 * Get the raw expedition preferences for a pet (liked and disliked location types)
 * Returns undefined if the pet has no specific preferences
 */
export function getPetExpeditionPreferences(petTypeId: number): {
	liked: readonly ExpeditionLocationType[]; disliked: readonly ExpeditionLocationType[];
} | undefined {
	return PET_EXPEDITION_PREFERENCES[petTypeId];
}

export type ExpeditionStatus = (typeof ExpeditionConstants.STATUS)[keyof typeof ExpeditionConstants.STATUS];
export type ExpeditionLocationType = (typeof ExpeditionConstants.EXPEDITION_LOCATION_TYPES)[keyof typeof ExpeditionConstants.EXPEDITION_LOCATION_TYPES];
export type RewardWeights = Record<"money" | "experience" | "points", number>;
export type SpeedCategory = (typeof ExpeditionConstants.SPEED_CATEGORIES)[keyof typeof ExpeditionConstants.SPEED_CATEGORIES];

/**
 * Configuration for terrain-based risk generation using power transformation
 */
export interface TerrainDifficultyConfig {
	skewFactor: number;
}

/**
 * Generate a risk value based on terrain type using power transformation
 * All terrains can produce values from 0 to 100, but with different probability distributions
 * - Plains (skew 0.5): Higher probability of low risk, but high risk still possible
 * - Cave (skew 1.8): Higher probability of high risk, but low risk still possible
 * @param locationType - The terrain/location type
 * @param random - Random value between 0 and 1 (typically from RandomUtils.crowniclesRandom.realZeroToOneInclusive())
 * @returns Risk value between 0 and 100, with probability biased by terrain difficulty
 */
export function generateTerrainBasedRisk(locationType: ExpeditionLocationType, random: number): number {
	const config = ExpeditionConstants.TERRAIN_DIFFICULTY[locationType];

	/*
	 * Power transformation: random^skewFactor
	 * - skewFactor < 1: Maps uniform distribution to favor higher values (inverse power)
	 * - skewFactor > 1: Maps uniform distribution to favor lower values
	 * We invert the result so that higher skew = higher risk tendency
	 */
	const transformedRandom = Math.pow(random, 1 / config.skewFactor);

	// Scale to 0-100 and round
	return Math.round(transformedRandom * 100);
}
