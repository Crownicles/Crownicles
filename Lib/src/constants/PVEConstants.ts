export abstract class PVEConstants {
	static readonly TIME_AFTER_INACTIVITY_ON_BOAT_IS_NOT_ACCEPTED = 24 * 3 * 3600 * 1000; // 3 days;

	static readonly TIME_BETWEEN_SMALL_EVENTS = 18 * 1000; // 18 seconds

	static readonly TRAVEL_COST = [
		0,
		15,
		25
	];

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
		}
	};

	// Allow commands is better than disallowed commands because if there is a new command it will not be allowed by default


	static readonly FIGHT_REWARDS = {
		RANDOM_MAX_REWARD: 100,
		MONEY_FACTOR: 3.8,
		XP_FACTOR: 6.8,
		GUILD_SCORE_FACTOR: 2.8,
		GUILD_XP_FACTOR: 4.7
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

	static readonly BOSS_LOOT = {
		MIN_DROPS: 5,
		MAX_DROPS: 10,
		RARITY_WEIGHTS: {
			1: 60, // COMMON
			2: 30, // UNCOMMON
			3: 10 // RARE
		} as Record<number, number>
	};

	/**
	 * Loot tables for each PVE boss map location.
	 * Each entry maps a map ID to an array of material IDs that can drop.
	 */
	static readonly BOSS_LOOT_TABLES: Record<number, readonly number[]> = {
		// Island 1 - Tropical
		1001: [
			52,
			40,
			45,
			8,
			58,
			2,
			51
		], // Forest: nature + wood + rope
		1002: [
			14,
			7,
			24,
			13,
			29,
			22,
			81
		], // Ruins: metal + alloy + leather
		1003: [
			70,
			1,
			50,
			21,
			39,
			4,
			16,
			44
		], // Mine: metal + explosive
		1004: [
			70,
			24,
			29,
			63,
			41,
			11,
			42
		], // Mountain: metal + leather + nature
		1005: [
			35,
			1,
			21,
			80,
			82,
			56,
			86,
			65
		], // Volcano (final): explosive + magic + metal
		// Island 2 - Ice
		1101: [
			54,
			25,
			55,
			12,
			15,
			48,
			26
		], // Tundra: nature + leather + rope
		1102: [
			53,
			89,
			30,
			71,
			5,
			67,
			69,
			34
		], // Crystal Cavern: magic + spiritual
		1103: [
			72,
			89,
			60,
			73,
			33,
			62,
			61
		], // Blessed Doors: spiritual + magic
		1104: [
			50,
			70,
			23,
			90,
			79,
			85,
			87
		], // Ice Peak: metal + nature
		1105: [
			40,
			55,
			32,
			28,
			68,
			36,
			3
		], // Underground Lake: nature + poison
		1106: [
			7,
			20,
			9,
			75,
			43,
			27,
			31
		], // Ruins: alloy + leather + wood
		1107: [
			35,
			1,
			80,
			39,
			76,
			77,
			56,
			6,
			46
		] // Dragon's Nest (final): magic + explosive
	};
}
