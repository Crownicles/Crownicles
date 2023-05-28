export abstract class FightConstants {
	static readonly MAX_TURNS = 24;

	static readonly REQUIRED_LEVEL = 8;

	static readonly POINTS_REGEN_MINUTES = 15;

	static readonly POINTS_REGEN_AMOUNT = 50;

	static readonly FIGHT_ERROR = {
		NONE: "none",
		BABY: "error.baby",
		WRONG_LEVEL: "error.levelTooLow",
		DEAD: "error.dead",
		DISALLOWED_EFFECT: "error.cantFightStatus",
		OCCUPIED: "error.occupied",
		NO_FIGHT_POINTS: "error.noFightPoints",
		ELO_GAP: "error.eloGap",
		BEST_OF_3: "error.bestOf3"
	};

	// duration of the menu that search for an opponent in milliseconds
	static readonly ASKING_MENU_DURATION = 120000;

	// number of reaction the bot will accept before closing a fight request due to spam.
	static readonly SPAM_PROTECTION_MAX_REACTION_AMOUNT = 2;

	// amount of time a user has to react during a fight
	static readonly TIME_FOR_ACTION_SELECTION = 45000;

	// random variation of the damage a fight action will deal (between -this value and +this value)
	static readonly DAMAGE_RANDOM_VARIATION = 5;

	// depending on its level a player has a malus or bonus on the damage he deals
	static readonly PLAYER_LEVEL_MINIMAL_MALUS = -55;

	// depending on its level a player has a malus or bonus on the damage he deals
	static readonly PLAYER_LEVEL_MAXIMAL_BONUS = 55;

	// above this level a player has a cap on the bonus he gets from the level (the bonus is capped to the above value)
	static readonly MAX_PLAYER_LEVEL_FOR_BONUSES = 75;

	// multiplier of the damage a fight action will deal if it is a critical hit
	static readonly CRITICAL_HIT_MULTIPLIER = 1.5;

	// out of breath attack failure probability
	static readonly OUT_OF_BREATH_FAILURE_PROBABILITY = 0.8;

	// divider of the damage a fight action will deal if it is a miss
	static readonly FAILURE_DIVIDERS = [0.25, 0.2, 0.125, 0.1, 0];

	// Targets types
	static readonly TARGET = {
		SELF: 0,
		OPPONENT: 1
	};

	// kind of useless, but I don't care
	static OPERATOR = {
		PLUS: "+",
		MINUS: "-"
	};

	// amount of fight points a player will lose when he is poisoned
	static POISON_DAMAGE_PER_TURN = 30;

	// % of chance a player will heal himself when he is poisoned
	static POISON_END_PROBABILITY = 25;

	// empty string to register cancellation of an alteration display
	static CANCEL_ALTERATION_DISPLAY = "";

	static readonly UNCOUNTERABLE_ACTIONS = [
		"ultimateAttack",
		"benediction",
		"divineAttack",
		"none",
		"poisonousAttack",
		"concentration",
		"resting",
		"protection",
		"counterAttack",
		"defenseBuff",
		"fireAttack",
		"breathTakingAttack",
		"darkAttack",
		"cursedAttack",
		"outOfBreath",
		"outrageAttack",
		"roarAttack",
		"summonAttack",
		"stealth"
	];

	static readonly ELO = {
		DEFAULT_ELO: 0,
		MAX_ELO_GAP: 400,
		DEFAULT_K_FACTOR: 32,
		LOW_K_FACTOR: 24,
		VERY_LOW_K_FACTOR: 16,
		LOW_K_FACTOR_THRESHOLD: 2100,
		VERY_LOW_K_FACTOR_THRESHOLD: 2400,
		LOW_LEVEL_BONUS_THRESHOLD: 1000,
		LEAGUE_POINTS_REWARDS_COEFFICIENT_1: 0.4446,
		LEAGUE_POINTS_REWARDS_COEFFICIENT_2: 12.8819,
		LEAGUE_POINTS_REWARD_BASE_VALUE: 3994,
		MAX_RANK_FOR_LEAGUE_POINTS_REWARD: 200
	};

	// if a player has a fight countdown higher than this value, he will not appear in the glory top
	static readonly FIGHT_COUNTDOWN_MAXIMAL_VALUE = 0;

	// a player will not earn more fightCountdown than this value
	static readonly FIGHT_COUNTDOWN_REGEN_LIMIT = 7;

	// fightCountdown value for new players
	static readonly DEFAULT_FIGHT_COUNTDOWN = 10;

	// added at the end of the fight to the last message
	static readonly HANDSHAKE_EMOTE = "\uD83E\uDD1D";
}