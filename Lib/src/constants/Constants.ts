export class Constants {
	static readonly MESSAGES = {
		COLLECTOR_TIME: 120000,
		PROGRESS_BAR_SIZE: 20,
		MAX_SPAM_COUNT: 3,
		DEFAULT_REACTION_LIMIT: 1
	};

	static readonly XP = {
		BASE_VALUE: 325,
		COEFFICIENT: 1.041,
		MINUS: 188
	};


	static readonly REPORT = {
		HOURS_USED_TO_CALCULATE_FIRST_REPORT_REWARD: 1, // Used to get the amount of point a user will get in the first report, 1 hour = 60 points ( + some bonus )
		TIME_BETWEEN_BIG_EVENTS: 2 * 60 * 60 * 1000, // 2 hours
		BONUS_POINT_TIME_DIVIDER: 6,
		POINTS_BY_SMALL_EVENT: 50,
		PATH_SQUARE_COUNT: 16,
		TIME_BETWEEN_MINI_EVENTS: 9.75 * 60 * 1000 // 9 minutes and 45 seconds
	};

	// This constant represents the different types of values on which the players can be ranked
	static readonly RANK_TYPES = {
		LEVEL: "level",
		SCORE: "score",
		WEEKLY_SCORE: "weeklyScore",
		LAST_SEASON_GLORY: "gloryPointsLastSeason",
		GLORY: "gloryPoints"
	};

	static readonly LOGS = {
		FILE_MAX_SIZE: "20m",
		FILE_RETENTION: "30d",
		FILE_BASE_PATH: "./logs",
		FILE_ZIPPED_ARCHIVE: true
	};

	static readonly MISSION_SHOP = {
		RANGE_MISSION_MONEY: 1350,
		BASE_RATIO: 6500,
		SEED_RANGE: 1000,
		SIN_RANDOMIZER: 100000,
		KINGS_MONEY_VALUE_THRESHOLD_MISSION: 6500,
		PRICES: {
			MONEY: 50,
			VALUABLE_ITEM: 30,
			THOUSAND_POINTS: 5,
			PET_INFORMATION: 3,
			MISSION_SKIP: 10,
			BADGE: 150
		},
		THOUSAND_POINTS: 1000
	};

	static readonly BEGINNING = {
		START_MAP_LINK: 83,
		LAST_MAP_LINK: 77
	};

	static readonly MISSIONS = {
		SLOT_3_LEVEL: 55,
		SLOT_2_LEVEL: 25,
		SLOTS_LEVEL_PROBABILITIES: [
			{
				LEVEL: 0,
				EASY: 1,
				MEDIUM: 0,
				HARD: 0
			},
			{
				LEVEL: 10,
				EASY: 0.75,
				MEDIUM: 0.25,
				HARD: 0
			},
			{
				LEVEL: 20,
				EASY: 0.4,
				MEDIUM: 0.6,
				HARD: 0
			},
			{
				LEVEL: 40,
				EASY: 0.25,
				MEDIUM: 0.65,
				HARD: 0.1
			},
			{
				LEVEL: 50,
				EASY: 0.2,
				MEDIUM: 0.55,
				HARD: 0.25
			},
			{
				LEVEL: 60,
				EASY: 0.1,
				MEDIUM: 0.4,
				HARD: 0.5
			}
		],
		DAILY_MISSION_MONEY_MULTIPLIER: 0.5,
		DAILY_MISSION_POINTS_MULTIPLIER: 3.5
	};

	static readonly MINIMAL_PLAYER_SCORE = 100;


	static readonly MAX_TIME_BOT_RESPONSE = 30000;

	static readonly DM = {
		TITLE_SUPPORT: "Welcome to the Crownicles Assistance Program.",

		INTERACTION_SUPPORT: ":flag_gb: Hello, commands are disabled in private messages. Please go on a server to play!\n\n:flag_fr: Bonjour, les commandes sont désactivées en messages privés. Merci d'aller sur un serveur pour jouer !",
		TOO_LONG_MESSAGE: "*Message trop long, voir l'attaché dans le message.*",
		NO_MESSAGE: "*Aucun message*",
		COMMENT_MESSAGE_START: ">>> ",
		MAX_ATTACHMENTS: 10,
		MAX_MESSAGE_LENGTH_ALLOWED: 1900,
		INVITE_LINK: "https://discord.gg/5JqrMtZ"
	};

	static readonly CACHE_TIME = {
		INTERACTIONS: 900000
	};

	static readonly PROFILE = {
		MAX_EMOTE_DISPLAY_NUMBER: 10
	};


	static readonly JOIN_BOAT = {
		TIME_TRAVELLED_SUBTRAHEND: 30,
		TIME_TRAVELLED_THIRTY_MINUTES: 30,
		TIME_TRAVELLED_ONE_HOUR: 60,
		DIVISOR_TIME_TRAVELLED_LESS_THAN_ONE_HOUR: 3 // The divisor if the time travelled is less than one hour
	};

	static readonly DEFAULT_ERROR = "Hmmm... Something went very (very) wrong. Please share this issue with us here :\n\n"
		+ "https://github.com/Crownicles/Crownicles/issues/new?assignees=&labels=bug&template=bug_report.yml&title=%5BBUG%5D%3A+";
}

export type ConstantRange = {
	MIN: number; MAX: number;
};
