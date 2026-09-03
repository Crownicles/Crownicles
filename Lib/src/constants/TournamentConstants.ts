import { ItemRarity } from "./ItemConstants";

export abstract class TournamentConstants {
	static readonly MINIMUM_SERVER_MEMBER_COUNT = 1000;

	static readonly MINIMUM_PLAYER_LEVEL = 8;

	static readonly MAX_LEVEL_CAP = 2_147_483_647;

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

	static readonly RANK_REWARD_MAX_PERCENT = 120;

	static readonly RANK_REWARD_MIN_PERCENT = 25;

	static readonly RANK_REWARD_PERCENT_RANGE =
		TournamentConstants.RANK_REWARD_MAX_PERCENT - TournamentConstants.RANK_REWARD_MIN_PERCENT;

	static readonly RANK_REWARD_TARGET_RANK = 11;

	static readonly RANK_REWARD_TARGET_PERCENT = 50;

	static readonly RANK_REWARD_TARGET_PERCENT_OFFSET =
		TournamentConstants.RANK_REWARD_TARGET_PERCENT - TournamentConstants.RANK_REWARD_MIN_PERCENT;

	static readonly REWARD_PERCENTAGE_DIVISOR = 100;

	static readonly BASE_XP_REWARD = 2000;

	static readonly BASE_MONEY_REWARD = 2000;

	static readonly REWARD_ITEM_COUNT = 1;

	static readonly REWARD_ITEM_TOP_RANK_LIMIT = 15;

	static readonly REWARD_ITEM_MIN_RARITY_FIRST_RANK = ItemRarity.LEGENDARY;

	static readonly REWARD_ITEM_MIN_RARITY_LAST_TOP_RANK = ItemRarity.RARE;

	static readonly REWARD_ITEM_MIN_RARITY_RANGE =
		TournamentConstants.REWARD_ITEM_MIN_RARITY_FIRST_RANK - TournamentConstants.REWARD_ITEM_MIN_RARITY_LAST_TOP_RANK;

	static readonly REWARD_ITEM_TOP_RANK_RARITY_STEPS =
		TournamentConstants.REWARD_ITEM_TOP_RANK_LIMIT - 1;

	static readonly BO3_MAX_GAMES = 3;

	static readonly BO3_WINS_TO_FINISH = 2;

	static readonly CONTEXT_QUERY_TIMEOUT_MS = 5000;

	static readonly TOP_ELEMENTS_PER_PAGE = 15;
}
