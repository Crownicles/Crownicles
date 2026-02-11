export enum BlessingType {
	NONE = 0,
	AMPLIFIED_RAGE = 1,
	FIGHT_LOOT = 2,
	ENERGY_REGEN = 3,
	MONEY_BOOST = 4,
	SCORE_BOOST = 5,
	PET_LOVE = 6,
	HEAL_ALL = 7,
	EXPEDITION_TOKEN = 8,
	DAILY_MISSION = 9
}

/**
 * Money factor for smart contribution calculation
 */
export enum SmartContributionMoneyFactor {
	POOR = 0,
	MIDDLE = 1,
	RICH = 2
}

/**
 * Remaining pool factor for smart contribution calculation
 */
export enum SmartContributionRemainingFactor {
	ALMOST_FILLED = 0,
	LOW = 1,
	MEDIUM = 2,
	HIGH = 3
}

/**
 * Time urgency factor for smart contribution calculation
 */
export enum SmartContributionTimeFactor {
	PLENTY_OF_TIME = 0,
	SOME_TIME = 1,
	LESS_TIME = 2,
	URGENT = 3
}

export abstract class BlessingConstants {
	/**
	 * Duration range of a blessing in hours
	 */
	static readonly MIN_DURATION_HOURS = 8;

	static readonly MAX_DURATION_HOURS = 24;

	/**
	 * Target fill time for the pool in days — used for dynamic pricing
	 */
	static readonly TARGET_FILL_DAYS = 3;

	/**
	 * If the pool is not filled after this many days, it resets with a lower threshold
	 */
	static readonly POOL_EXPIRY_DAYS = 4;

	/**
	 * Initial pool threshold for the very first cycle
	 */
	static readonly INITIAL_POOL_THRESHOLD = 5000;

	/**
	 * Minimum pool threshold (floor for dynamic pricing)
	 */
	static readonly MIN_POOL_THRESHOLD = 500;

	/**
	 * Maximum pool threshold (ceiling for dynamic pricing)
	 */
	static readonly MAX_POOL_THRESHOLD = 500000;

	/**
	 * Maximum change in threshold per cycle (to prevent wild jumps)
	 */
	static readonly MAX_THRESHOLD_STEP = 10000;

	/**
	 * Multiplier applied to threshold when pool expires without being filled (4-day timeout)
	 */
	static readonly EXPIRY_THRESHOLD_MULTIPLIER = 0.5;

	/**
	 * Contribution option: fixed flat amount
	 */
	static readonly FLAT_CONTRIBUTION = 100;

	/**
	 * Contribution option: percentage of player's current money
	 */
	static readonly MONEY_PERCENTAGE_CONTRIBUTION = 0.02;

	/**
	 * Contribution option: multiplier applied to player's level
	 */
	static readonly LEVEL_MULTIPLIER_CONTRIBUTION = 10;

	/**
	 * Total number of blessing types (1-9)
	 */
	static readonly TOTAL_BLESSING_TYPES = 9;

	/**
	 * Multiplier for fight loot blessing (effect #2)
	 */
	static readonly FIGHT_LOOT_MULTIPLIER = 4;

	/**
	 * Multiplier for energy regen blessing (effect #3)
	 */
	static readonly ENERGY_REGEN_MULTIPLIER = 2;

	/**
	 * Bonus percentage for money boost blessing (effect #4)
	 */
	static readonly MONEY_BOOST_PERCENTAGE = 0.10;

	/**
	 * Bonus percentage for score boost blessing (effect #5)
	 */
	static readonly SCORE_BOOST_PERCENTAGE = 0.20;

	/**
	 * Multiplier for pet love blessing (effect #6)
	 */
	static readonly PET_LOVE_MULTIPLIER = 2;

	/**
	 * Multiplier for health potion effectiveness blessing (effect #7)
	 */
	static readonly HEALTH_POTION_MULTIPLIER = 2;

	/**
	 * Multiplier for daily mission rewards blessing (effect #9)
	 */
	static readonly DAILY_MISSION_MULTIPLIER = 2;

	/**
	 * Rarity of the altar small event (1 = very rare)
	 */
	static readonly ALTAR_RARITY = 15;

	/**
	 * Contribution amount at which the player has 100% chance of getting bonus gems.
	 * 5 gems ≈ 20 000 gold, so contributing 20 000 gold guarantees 5 gems.
	 * Below this amount, the probability scales linearly (e.g. 10 000 gold = 50% chance).
	 */
	static readonly CONTRIBUTION_GEMS_FULL_PROBABILITY_AMOUNT = 20000;

	/**
	 * Number of bonus gems awarded
	 */
	static readonly CONTRIBUTION_BONUS_GEMS_AMOUNT = 5;

	/**
	 * Probability of getting a random item when contributing more than the flat amount (4%)
	 */
	static readonly CONTRIBUTION_BONUS_ITEM_PROBABILITY = 0.04;

	/**
	 * Lifetime contribution threshold to earn the Oracle Patron badge
	 */
	static readonly ORACLE_PATRON_THRESHOLD = 150000;

	/**
	 * Smart contribution amounts array (indexed by score 0-8):
	 */
	static readonly SMART_CONTRIBUTION_AMOUNTS = [
		50,
		200,
		250,
		300,
		500,
		750,
		1000,
		1200,
		1500
	] as const;

	/**
	 * Money threshold for "middle" player (50k+)
	 */
	static readonly SMART_CONTRIBUTION_MIDDLE_THRESHOLD = 50000;

	/**
	 * Money threshold for "rich" player (100k+)
	 */
	static readonly SMART_CONTRIBUTION_RICH_THRESHOLD = 100000;

	/**
	 * Remaining pool threshold for "low" remaining (7.5k+)
	 */
	static readonly SMART_CONTRIBUTION_LOW_REMAINING_THRESHOLD = 7500;

	/**
	 * Remaining pool threshold for "medium" remaining (15k+)
	 */
	static readonly SMART_CONTRIBUTION_MEDIUM_REMAINING_THRESHOLD = 15000;

	/**
	 * Remaining pool threshold for "high" remaining (30k+)
	 */
	static readonly SMART_CONTRIBUTION_HIGH_REMAINING_THRESHOLD = 30000;

	/**
	 * Time threshold for "urgent" (hours)
	 */
	static readonly SMART_CONTRIBUTION_URGENT_TIME_HOURS = 12;

	/**
	 * Time threshold for "less time" (hours)
	 */
	static readonly SMART_CONTRIBUTION_MEDIUM_TIME_HOURS = 36;

	/**
	 * Time threshold for "plenty of time" (days)
	 */
	static readonly SMART_CONTRIBUTION_RELAXED_TIME_DAYS = 3;
}
