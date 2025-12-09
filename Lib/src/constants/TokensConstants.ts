export abstract class TokensConstants {
	static readonly MAX = 20;

	static readonly LEVEL_TO_UNLOCK = 5;

	static readonly DAILY = {
		FREE_PER_DAY: 3
	};

	static readonly EXPEDITION = {
		REWARD_INDEX_OFFSET: -1,

		/** Duration threshold in minutes below which a malus is applied (1 hour) */
		SHORT_DURATION_THRESHOLD_MINUTES: 60,

		/** Token malus for expeditions shorter than 1 hour */
		SHORT_DURATION_MALUS: 1,

		/** Token malus for expeditions with reward index 0 */
		LOW_REWARD_INDEX_MALUS: 1
	};

	static readonly REPORT = {
		BASE_COST: 1,
		MINUTES_PER_ADDITIONAL_TOKEN: 28,
		MAX_COST: 5
	};
}
