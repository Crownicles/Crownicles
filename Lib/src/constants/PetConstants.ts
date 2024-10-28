export type PetInteraction = {
	name:string,
	probabilityWeight:number
}

export abstract class PetConstants {
	static readonly IS_FOOD = 1;

	static readonly NICKNAME_LENGTH_RANGE = {
		MIN: 3,
		MAX: 16
	};

	static readonly SEX = {
		MALE: "m",
		FEMALE: "f",
		MALE_FULL: "male",
		FEMALE_FULL: "female"
	};

	static readonly PET_INTERACTIONS_NAMES = {
		WIN_MONEY: "money",
		WIN_HEALTH: "gainLife",
		WIN_LOVE: "gainLove",
		WIN_ENERGY: "gainEnergy",
		WIN_FOOD: "food",
		NOTHING: "nothing",
		WIN_TIME: "gainTime",
		WIN_POINTS: "points",
		WIN_BADGE: "badge",
		LOSE_HEALTH: "loseLife",
		LOSE_MONEY: "loseMoney",
		LOSE_TIME: "loseTime",
		PET_FLEE: "petFlee",
		LOSE_LOVE: "loseLove",
		WIN_ITEM: "item"
	};

	static readonly PET_INTERACTIONS: {PET_NORMAL:{[interactionKey:string]:PetInteraction}[], PET_FEISTY:{[interactionKey:string]:PetInteraction}} = {
		PET_NORMAL: [
			{},
			{
				WIN_ENERGY: {name: this.PET_INTERACTIONS_NAMES.WIN_ENERGY, probabilityWeight: 9},
				WIN_FOOD: {name: this.PET_INTERACTIONS_NAMES.WIN_FOOD, probabilityWeight: 5},
				NOTHING: {name: this.PET_INTERACTIONS_NAMES.NOTHING, probabilityWeight: 15},
				WIN_POINTS: {name: this.PET_INTERACTIONS_NAMES.WIN_POINTS, probabilityWeight: 5}
			},
			{
				WIN_LOVE: {name: this.PET_INTERACTIONS_NAMES.WIN_LOVE, probabilityWeight: 6}
			},
			{
				WIN_MONEY: {name: this.PET_INTERACTIONS_NAMES.WIN_MONEY, probabilityWeight: 9},
				WIN_TIME: {name: this.PET_INTERACTIONS_NAMES.WIN_TIME, probabilityWeight: 4}
			},
			{
				WIN_HEALTH: {name: this.PET_INTERACTIONS_NAMES.WIN_HEALTH, probabilityWeight: 5}
			},
			{
				WIN_ITEM: {name: this.PET_INTERACTIONS_NAMES.WIN_ITEM, probabilityWeight: 3}
			},
			{
				WIN_BADGE: {name: this.PET_INTERACTIONS_NAMES.WIN_BADGE, probabilityWeight: 1}
			}
		],
		PET_FEISTY: {
			LOSE_HEALTH: {name: this.PET_INTERACTIONS_NAMES.LOSE_HEALTH, probabilityWeight: 5},
			LOSE_MONEY: {name: this.PET_INTERACTIONS_NAMES.LOSE_MONEY, probabilityWeight: 5},
			LOSE_TIME: {name: this.PET_INTERACTIONS_NAMES.LOSE_TIME, probabilityWeight: 5},
			PET_FLEE: {name: this.PET_INTERACTIONS_NAMES.PET_FLEE, probabilityWeight: 1},
			LOSE_LOVE: {name: this.PET_INTERACTIONS_NAMES.LOSE_LOVE, probabilityWeight: 5}
		}
	};

	static readonly BREED_COOLDOWN = 60 * 60 * 1000; // 1 hour

	static readonly MAX_LOVE_POINTS = 100;

	static readonly BASE_LOVE = 10;

	static readonly GUILD_LEVEL_USED_FOR_NO_GUILD_LOOT = 20;

	static readonly LOVE_LEVELS = [5, 20, 50];

	static readonly LOVE_LEVEL = {
		FEISTY: 1,
		WILD: 2,
		FEARFUL: 3,
		TAMED: 4,
		TRAINED: 5
	};

	static readonly SELL_PRICE = {
		MIN: 100,
		MAX: 50000
	};

	static readonly DEFAULT_PET_ID = 0;

	static readonly SLOTS = 6;

	static readonly ICONS = {
		MALE: "♂️",
		FEMALE: "♀️",
		RARITY: "⭐"
	};

	/*
	This array defines the probability of looting a pet based on two factors:
    - The rarity of the pet (represented by each column in the sub-arrays)
    - The level of the guild (represented by each sub-array, with each sub-array corresponding to a range of 10 guild levels)

    Each sub-array contains probabilities for 5 different rarities of pets (from most common to most rare).
    The probabilities are designed to sum up to 1 for each sub-array, ensuring that a pet will be looted.

    The array is structured as follows:
    - The first element of each sub-array represents the probability of looting the most common pet.
    - The second element represents the probability of the next rarer pet, and so on.
    - The last element represents the probability of looting the rarest pet.

    For example, a guild at level 1-10 has a 90% chance to loot the most common pet and a 0.01% chance to loot the rarest pet.
	 */
	// Todo: add unit test to check that each line is summing to 1
	static readonly PROBABILITIES = [
		[0.9000, 0.0900, 0.0090, 0.0009, 0.0001],
		[0.8940, 0.0916, 0.0109, 0.0023, 0.0012],
		[0.8760, 0.0964, 0.0166, 0.0065, 0.0045],
		[0.8460, 0.1044, 0.0262, 0.0135, 0.0099],
		[0.8040, 0.1156, 0.0396, 0.0233, 0.0175],
		[0.7500, 0.1300, 0.0568, 0.0359, 0.0273],
		[0.6840, 0.1476, 0.0778, 0.0513, 0.0393],
		[0.6060, 0.1684, 0.1026, 0.0695, 0.0535],
		[0.5160, 0.1924, 0.1312, 0.0905, 0.0699],
		[0.4140, 0.2196, 0.1637, 0.1143, 0.0884],
		[0.3000, 0.2500, 0.2000, 0.1409, 0.1091] // Todo: what happen for guilds lvl > 100
	];

	static RESTRICTIVES_DIETS = {
		CARNIVOROUS: "carnivorous",
		HERBIVOROUS: "herbivorous"
	};
}

export enum PET_ENTITY_GIVE_RETURN {
	NO_SLOT,
	GUILD,
	PLAYER
}