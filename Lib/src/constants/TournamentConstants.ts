export abstract class TournamentConstants {
	static readonly MINIMUM_SERVER_MEMBER_COUNT = 1000;

	static readonly MINIMUM_PLAYER_LEVEL = 8;

	static readonly MINIMUM_TOTAL_PARTICIPANTS = 20;

	static readonly MINIMUM_PARTICIPANTS_PER_CATEGORY = 10;

	static readonly CODE_VALIDITY_DAYS = 7;

	static readonly REGISTRATION_MINIMUM_DAYS = 1;

	static readonly REGISTRATION_MAXIMUM_DAYS = 7;

	static readonly COMBAT_MINIMUM_DAYS = 1;

	static readonly COMBAT_MAXIMUM_DAYS = 7;

	static readonly INITIAL_ATTACK_GLORY = 750;

	static readonly INITIAL_DEFENSE_GLORY = 750;

	static readonly LATE_INITIAL_DEFENSE_GLORY = 0;

	static readonly ENDING_NOTIFICATION_LEAD_HOURS = 24;

	static readonly MINIMUM_REWARD_MULTIPLIER = 20;

	static readonly REWARD_MULTIPLIER_PARTICIPANT_STEP = 10;

	static readonly LEVEL_50_REWARD_DIVISOR = 2;

	static readonly RANK_REWARD_MAX_PERCENT = 150;

	static readonly RANK_REWARD_MIN_PERCENT = 50;

	static readonly RANK_REWARD_PERCENT_RANGE =
		TournamentConstants.RANK_REWARD_MAX_PERCENT - TournamentConstants.RANK_REWARD_MIN_PERCENT;

	static readonly REWARD_PERCENTAGE_DIVISOR = 100;

	static readonly BASE_LEVEL_100_ITEM_REWARD_COUNT = 2;

	static readonly ADDITIONAL_ITEM_PARTICIPANT_STEP = 50;

	static readonly BO3_MAX_GAMES = 3;

	static readonly BO3_WINS_TO_FINISH = 2;

	static readonly CONTEXT_QUERY_TIMEOUT_MS = 5000;

	static readonly TOP_ELEMENTS_PER_PAGE = 15;
}
