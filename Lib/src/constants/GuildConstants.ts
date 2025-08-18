export abstract class GuildConstants {
	static readonly ICON: "https://i.imgur.com/sQHBly4.png";

	static readonly DEFAULT_VALUES = {
		SCORE: 0,
		LEVEL: 0,
		EXPERIENCE: 0,
		COMMON_FOOD: 0,
		HERBIVOROUS_FOOD: 0,
		CARNIVOROUS_FOOD: 0,
		ULTIMATE_FOOD: 0
	};

	static readonly XP_CALCULATION_STEP = 5000;

	static readonly XP_DIVIDER = {
		MIN: 20,
		MAX: 20 / 9
	};

	static readonly REQUIRED_LEVEL = 10;

	static readonly MAX_GUILD_MEMBERS = 6;

	static readonly GUILD_NAME_LENGTH_RANGE = {
		MIN: 2,
		MAX: 15
	};

	static readonly DESCRIPTION_LENGTH_RANGE = {
		MIN: 2,
		MAX: 140
	};

	static readonly MAX_LEVEL = 150;

	static readonly MAX_COMMON_PET_FOOD = 25;

	static readonly MAX_HERBIVOROUS_PET_FOOD = 15;

	static readonly MAX_CARNIVOROUS_PET_FOOD = 15;

	static readonly MAX_ULTIMATE_PET_FOOD = 5;

	static readonly MAX_PET_FOOD = [
		25, // Common food
		15, // Carnivorous food
		15, // Herbivorous food
		5 // Ultimate food
	];

	static GOLDEN_GUILD_LEVEL = 100;

	static SUPER_BADGE_MAX_RANK = 25;
}
