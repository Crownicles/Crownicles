export abstract class PVEConstants {

	static readonly TIME_AFTER_INACTIVITY_ON_BOAT_IS_NOT_ACCEPTED = 24 * 3 * 3600 * 1000; // 3 days;

	static readonly TIME_BETWEEN_SMALL_EVENTS = 18 * 1000; // 18 seconds

	static readonly TRAVEL_COST = [0, 15, 25];

	static readonly COLLECTOR_TIME = 30000;

	static readonly FIGHT_POINTS_SMALL_EVENT = {
		MIN_PERCENT: 0.02,
		MAX_PERCENT: 0.07
	};

	static readonly MIN_LEVEL = 20;

	static readonly MONSTER_LEVEL_RANDOM_RANGE = 10;

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
		},
		ENERGY: {
			A: 0.06211,
			B: 11.18950,
			C: 30.30303
		}
	};

	// Allow commands is better than disallowed commands because if there is a new command it will not be allowed by default
	static readonly ALLOWED_COMMANDS = [
		"guild",
		"guildcreate",
		"guilddescription",
		"guildelder",
		"guildelderremove",
		"guildinvite",
		"guildkick",
		"guildleave",
		"guildshelter",
		"guildstorage",
		"missions",
		"pet",
		"petfeed",
		"petfree",
		"petnickname",
		"petsell",
		"pettrade",
		"pettransfer",
		"classesinfo",
		"badge",
		"help",
		"idea",
		"inventory",
		"invite",
		"map",
		"notifications",
		"ping",
		"prefix",
		"profile",
		"rarity",
		"report",
		"respawn",
		"sell",
		"switch",
		"top",
		"update",
		"vote",
		"test"
	];

	/**
	 * The formula is
	 * f(x) = ax² + bx + c
	 * with x the total monster stats for xp and money
	 *
	 * The formula is
	 * f(x) = ax + b
	 * for the level multiplier
	 */
	static readonly FIGHT_REWARDS = {
		TOTAL_RATIO_RANDOM_RANGE: 0.1,
		GUILD_SCORE_MULTIPLIER: 10,
		XP: {
			A: 0.1529,
			B: 0.9686,
			C: 106.4
		},
		GUILD_XP: {
			A: 0.1207,
			B: 0.8671,
			C: 84
		},
		MONEY: {
			A: 0.1089,
			B: 0.7454,
			C: 56
		},
		LEVEL_MULTIPLIER: {
			A: 0.0125,
			B: 0.75
		}
	};

	static readonly OUT_OF_BREATH_CHOOSE_PROBABILITY = 0.1;

	static readonly GUILD_ATTACK_PROBABILITY = 0.25;

	static readonly MINIMAL_ENERGY_RATIO = 0.8;

	static readonly RAGE_MIN_MULTIPLIER = 1;

	static readonly MINUTES_CHECKED_FOR_PLAYERS_THAT_WERE_ON_THE_ISLAND = 60;

	static readonly RAGE_MAX_DAMAGE = 250;

	static readonly DAMAGE_INCREASED_DURATION = 7;

	static readonly MONEY_MALUS_MULTIPLIER_FOR_GUILD_PLAYERS = 1;

	static readonly MONEY_MALUS_MULTIPLIER_FOR_SOLO_PLAYERS = 2;

	static readonly MONEY_LOST_PER_LEVEL_ON_DEATH = 3.4;

	static readonly GUILD_POINTS_LOST_ON_DEATH = 150;

	static readonly RANDOM_RANGE_FOR_GUILD_POINTS_LOST_ON_DEATH = 20;
}
