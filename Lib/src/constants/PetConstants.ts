import { FightConstants } from "./FightConstants";
import { ItemRarity } from "./ItemConstants";

export type PetInteraction = {
	name: string;
	probabilityWeight: number;
};

export enum PetDiet {
	CARNIVOROUS = "carnivorous",
	HERBIVOROUS = "herbivorous",
	OMNIVOROUS = "omnivorous"
}

export abstract class PetConstants {
	/**
	 * Contexts in which pet availability can be checked
	 */
	static readonly AVAILABILITY_CONTEXT = {
		SMALL_EVENT: "smallEvent",
		ATTACK_FIGHT: "attackFight",
		DEFENSE_FIGHT: "defenseFight"
	} as const;

	static readonly NICKNAME_LENGTH_RANGE = {
		MIN: 3,
		MAX: 16
	};

	static readonly PET_RARITY_RANGE = {
		MIN: ItemRarity.COMMON,
		MAX: ItemRarity.MYTHICAL
	};

	static readonly PET_AGE_GROUP_NAMES = {
		ANCESTOR: "ancestor",
		VERY_OLD: "veryOld",
		OLD: "old",
		ADULT: "adult",
		OTHER: "other"
	};

	static readonly PET_AGE_GROUPS_THRESHOLDS = {
		ANCESTOR: 100,
		VERY_OLD: 1000,
		OLD: 5000,
		ADULT: 20000
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

	/**
	 * Minimum tier that has actual interactions (tier 0 is empty placeholder)
	 */
	static readonly MIN_UNLOCKED_INTERACTION_TIER = 1;

	static readonly PET_INTERACTIONS: {
		PET_NORMAL: { [interactionKey: string]: PetInteraction }[];
		PET_FEISTY: { [interactionKey: string]: PetInteraction };
	} = {
		PET_NORMAL: [
			{}, // Tier 0: empty placeholder, interactions start at tier 1
			{
				WIN_ENERGY: {
					name: this.PET_INTERACTIONS_NAMES.WIN_ENERGY, probabilityWeight: 9
				},
				WIN_FOOD: {
					name: this.PET_INTERACTIONS_NAMES.WIN_FOOD, probabilityWeight: 5
				},
				NOTHING: {
					name: this.PET_INTERACTIONS_NAMES.NOTHING, probabilityWeight: 15
				},
				WIN_POINTS: {
					name: this.PET_INTERACTIONS_NAMES.WIN_POINTS, probabilityWeight: 5
				}
			},
			{
				WIN_LOVE: {
					name: this.PET_INTERACTIONS_NAMES.WIN_LOVE, probabilityWeight: 6
				}
			},
			{
				WIN_MONEY: {
					name: this.PET_INTERACTIONS_NAMES.WIN_MONEY, probabilityWeight: 9
				},
				WIN_TIME: {
					name: this.PET_INTERACTIONS_NAMES.WIN_TIME, probabilityWeight: 4
				}
			},
			{
				WIN_HEALTH: {
					name: this.PET_INTERACTIONS_NAMES.WIN_HEALTH, probabilityWeight: 5
				}
			},
			{
				WIN_ITEM: {
					name: this.PET_INTERACTIONS_NAMES.WIN_ITEM, probabilityWeight: 3
				}
			},
			{
				WIN_BADGE: {
					name: this.PET_INTERACTIONS_NAMES.WIN_BADGE, probabilityWeight: 1
				}
			}
		],
		PET_FEISTY: {
			LOSE_HEALTH: {
				name: this.PET_INTERACTIONS_NAMES.LOSE_HEALTH, probabilityWeight: 5
			},
			LOSE_MONEY: {
				name: this.PET_INTERACTIONS_NAMES.LOSE_MONEY, probabilityWeight: 5
			},
			LOSE_TIME: {
				name: this.PET_INTERACTIONS_NAMES.LOSE_TIME, probabilityWeight: 5
			},
			PET_FLEE: {
				name: this.PET_INTERACTIONS_NAMES.PET_FLEE, probabilityWeight: 1
			},
			LOSE_LOVE: {
				name: this.PET_INTERACTIONS_NAMES.LOSE_LOVE, probabilityWeight: 5
			}
		}
	};

	static readonly BREED_COOLDOWN = 30 * 60 * 1000; // 30 minutes

	static readonly MAX_LOVE_POINTS = 110;

	static readonly TRAINED_LOVE_THRESHOLD = 100;

	static readonly BASE_LOVE = 10;

	static readonly DAILY_LOVE_LOSS = 2;

	static readonly VIGOR = {
		MAX: 6,
		MIN: 0,
		LOVE_DIVIDER: 3,
		DIVIDER: 10,
		ENRAGED_MULTIPLIER: 2
	};

	static readonly GUILD_LEVEL_USED_FOR_NO_GUILD_LOOT = 20;

	static readonly LOVE_LEVELS = [
		5,
		20,
		50
	];

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

	static readonly POST_FIGHT_LOVE_GAIN_RANGE = {
		MIN: 0,
		MAX: 2
	};

	static readonly POST_FIGHT_REACTION_TYPES = {
		LOVE_GAIN: "loveGain",
		TRAINED: "trained"
	} as const;


	static readonly SLOTS = 6;


	static RESTRICTIVES_DIETS = {
		CARNIVOROUS: PetDiet.CARNIVOROUS,
		HERBIVOROUS: PetDiet.HERBIVOROUS
	};

	static readonly PET_FOOD = {
		COMMON_FOOD: "commonFood",
		CARNIVOROUS_FOOD: "carnivorousFood",
		HERBIVOROUS_FOOD: "herbivorousFood",
		ULTIMATE_FOOD: "ultimateFood"
	} as const;

	static readonly PET_FOOD_BY_ID = [
		PetConstants.PET_FOOD.COMMON_FOOD,
		PetConstants.PET_FOOD.HERBIVOROUS_FOOD,
		PetConstants.PET_FOOD.CARNIVOROUS_FOOD,
		PetConstants.PET_FOOD.ULTIMATE_FOOD
	] as const;

	static readonly PETS = {
		NO_PET: 0,
		DOG: 1,
		POODLE: 2,
		CAT: 3,
		BLACK_CAT: 4,
		MOUSE: 5,
		HAMSTER: 6,
		RABBIT: 7,
		COW: 8,
		PIG: 9,
		CHICKEN: 10,
		BIRD: 11,
		DUCK: 12,
		HORSE: 13,
		TURTLE: 14,
		SNAKE: 15,
		LIZARD: 16,
		SHEEP: 17,
		GOAT: 18,
		TURKEY: 19,
		FOX: 20,
		BEAR: 21,
		KOALA: 22,
		FROG: 23,
		MONKEY: 24,
		PENGUIN: 25,
		OWL: 26,
		BAT: 27,
		WOLF: 28,
		BOAR: 29,
		SEAL: 30,
		HIPPO: 31,
		LLAMA: 32,
		SWAN: 33,
		FLAMINGO: 34,
		RACCOON: 35,
		SKUNK: 36,
		BADGER: 37,
		BEAVER: 38,
		SLOTH: 39,
		CHIPMUNK: 40,
		HEDGEHOG: 41,
		POLAR_BEAR: 42,
		PANDA: 43,
		SCORPION: 44,
		CROCODILE: 45,
		ELEPHANT: 46,
		ZEBRA: 47,
		RHINO: 48,
		DROMEDARY: 49,
		CAMEL: 50,
		GIRAFFE: 51,
		KANGAROO: 52,
		PEACOCK: 53,
		PARROT: 54,
		OTTER: 55,
		TIGER: 56,
		LION: 57,
		EAGLE: 58,
		DODO: 59,
		LEOPARD: 60,
		MAMMOTH: 61,
		DOVE: 62,
		UNICORN: 63,
		DRAGON: 64,
		T_REX: 65,
		STITCH: 66,
		SNOWMAN: 67,
		SCARLET_DUCK: 68,
		SNOW_PERSON: 69,
		ALIEN: 70,
		OCTOPUS: 71,
		EMPEROR_PENGUIN: 72,
		FISH: 73,
		TROPICAL_FISH: 74,
		PUFFERFISH: 75,
		JELLYFISH: 76,
		SHARK: 77,
		WHALE: 78,
		WHALE_2: 79,
		SHRIMP: 80,
		LOBSTER: 81,
		DOLPHIN: 82,
		PHOENIX: 83,
		DINOSAUR: 84,
		SNAIL: 85,
		CRAB: 86,
		DEER: 87,
		WATER_BUFFALO: 88,
		BISON: 89,
		ORANGUTAN: 90,
		GORILLA: 91,
		CHICK: 92,
		RAT: 93,
		BLACK_BIRD: 94,
		RAVEN: 95,
		DONKEY: 96,
		GOOSE: 97,
		MOOSE: 98,
		JACK_O_LANTERN: 99,
		GHOST: 100,
		VAMPIRE: 101,
		FAIRY: 102
	};

	static readonly PET_BEHAVIORS = [
		{
			petIds: [PetConstants.PETS.SHARK],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.SCARE_FISH
		},
		{
			petIds: [
				PetConstants.PETS.FISH,
				PetConstants.PETS.TROPICAL_FISH,
				PetConstants.PETS.PUFFERFISH,
				PetConstants.PETS.DOLPHIN
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.FISH_PROTECT_AGAINST_FIRE
		},
		{
			petIds: [
				PetConstants.PETS.LION,
				PetConstants.PETS.TIGER,
				PetConstants.PETS.LEOPARD
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.CLAWS
		},
		{
			petIds: [
				PetConstants.PETS.CAT,
				PetConstants.PETS.BADGER
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.SMALL_CLAWS
		},
		{
			petIds: [PetConstants.PETS.DRAGON],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.SPIT_FIRE
		},
		{
			petIds: [PetConstants.PETS.VAMPIRE],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.MAKE_BLEED
		},
		{
			petIds: [PetConstants.PETS.JACK_O_LANTERN],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.PET_PETRIFIED
		},
		{
			petIds: [
				PetConstants.PETS.DOG,
				PetConstants.PETS.POODLE,
				PetConstants.PETS.FOX,
				PetConstants.PETS.WOLF,
				PetConstants.PETS.CROCODILE
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.BITE
		},
		{
			petIds: [
				PetConstants.PETS.SCORPION,
				PetConstants.PETS.SNAKE
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.POISONOUS_BITE
		},
		{
			petIds: [PetConstants.PETS.MOUSE],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.SCARE_ELEPHANT
		},
		{
			petIds: [PetConstants.PETS.ELEPHANT],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.ELEPHANT_REMEMBER_LAST_ACTION
		},
		{
			petIds: [
				PetConstants.PETS.HAMSTER,
				PetConstants.PETS.RABBIT,
				PetConstants.PETS.TURKEY,
				PetConstants.PETS.CHIPMUNK,
				PetConstants.PETS.FLAMINGO,
				PetConstants.PETS.CHICK
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.TRIES_TO_HELP
		},
		{
			petIds: [
				PetConstants.PETS.CHICKEN,
				PetConstants.PETS.DUCK,
				PetConstants.PETS.PEACOCK,
				PetConstants.PETS.BIRD,
				PetConstants.PETS.DODO,
				PetConstants.PETS.PARROT,
				PetConstants.PETS.BLACK_BIRD,
				PetConstants.PETS.GOOSE
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.PECK
		},
		{
			petIds: [
				PetConstants.PETS.KOALA,
				PetConstants.PETS.SLOTH,
				PetConstants.PETS.SHRIMP,
				PetConstants.PETS.PANDA,
				PetConstants.PETS.SNAIL
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.IS_USELESS
		},
		{
			petIds: [
				PetConstants.PETS.COW,
				PetConstants.PETS.BEAR,
				PetConstants.PETS.BOAR,
				PetConstants.PETS.BISON,
				PetConstants.PETS.WATER_BUFFALO
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.PET_CHARGE
		},
		{
			petIds: [
				PetConstants.PETS.SHEEP,
				PetConstants.PETS.GOAT,
				PetConstants.PETS.SWAN,
				PetConstants.PETS.PIG
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.PET_SMALL_CHARGE
		},
		{
			petIds: [
				PetConstants.PETS.FROG,
				PetConstants.PETS.SKUNK
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.PET_POISON
		},
		{
			petIds: [
				PetConstants.PETS.BLACK_CAT,
				PetConstants.PETS.RAVEN,
				PetConstants.PETS.GHOST
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.PET_CURSE
		},
		{
			petIds: [
				PetConstants.PETS.HORSE,
				PetConstants.PETS.ZEBRA,
				PetConstants.PETS.DROMEDARY,
				PetConstants.PETS.CAMEL,
				PetConstants.PETS.DONKEY
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.BOOST_SPEED
		},
		{
			petIds: [PetConstants.PETS.MOOSE],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.BREAK_ARMOR
		},
		{
			petIds: [PetConstants.PETS.TURTLE],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.BOOST_DEFENSE
		},
		{
			petIds: [PetConstants.PETS.LIZARD],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.SMALL_REGEN
		},
		{
			petIds: [
				PetConstants.PETS.SNOWMAN,
				PetConstants.PETS.SNOW_PERSON
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.SNOW_BALL
		},
		{
			petIds: [
				PetConstants.PETS.MAMMOTH,
				PetConstants.PETS.POLAR_BEAR
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.PROTECT_AGAINST_COLD
		},
		{
			petIds: [PetConstants.PETS.JELLYFISH],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.MEDUSE_PARALYZE
		},
		{
			petIds: [PetConstants.PETS.HEDGEHOG],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.REVENGE
		},
		{
			petIds: [
				PetConstants.PETS.MONKEY,
				PetConstants.PETS.RACCOON
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.STEAL_WEAPON
		},
		{
			petIds: [PetConstants.PETS.BAT],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.VAMPIRISM
		},
		{
			petIds: [PetConstants.PETS.UNICORN],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.RAINBOW_POWER
		},
		{
			petIds: [
				PetConstants.PETS.T_REX,
				PetConstants.PETS.STITCH,
				PetConstants.PETS.HIPPO
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.GOES_WILD
		},
		{
			petIds: [
				PetConstants.PETS.PENGUIN,
				PetConstants.PETS.EMPEROR_PENGUIN
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.SLIPPING
		},
		{
			petIds: [
				PetConstants.PETS.OWL,
				PetConstants.PETS.EAGLE,
				PetConstants.PETS.GIRAFFE
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.UN_BLIND
		},
		{
			petIds: [PetConstants.PETS.OCTOPUS],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.SPIT_INK
		},
		{
			petIds: [
				PetConstants.PETS.KANGAROO,
				PetConstants.PETS.GORILLA
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.PET_HIT
		},
		{
			petIds: [
				PetConstants.PETS.RHINO,
				PetConstants.PETS.DEER
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.HORN
		},
		{
			petIds: [PetConstants.PETS.DOVE],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.HEAL_EVERYONE
		},
		{
			petIds: [
				PetConstants.PETS.LOBSTER,
				PetConstants.PETS.CRAB
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.PINCH
		},
		{
			petIds: [PetConstants.PETS.ALIEN],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.HYPNOSIS
		},
		{
			petIds: [
				PetConstants.PETS.OTTER,
				PetConstants.PETS.SEAL
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.HELP_BREATHE
		},
		{
			petIds: [PetConstants.PETS.LLAMA],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.SPIT
		},
		{
			petIds: [
				PetConstants.PETS.WHALE,
				PetConstants.PETS.WHALE_2
			],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.SWALLOW
		},
		{
			petIds: [PetConstants.PETS.BEAVER],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.BUILD_BARRAGE
		},
		{
			petIds: [PetConstants.PETS.SCARLET_DUCK],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.CREATE_BOMB
		},
		{
			petIds: [PetConstants.PETS.PHOENIX],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.HEAL_OWNER_IN_ENERGY_RANGE
		},
		{
			petIds: [PetConstants.PETS.DINOSAUR],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.CRUSH
		},
		{
			petIds: [PetConstants.PETS.ORANGUTAN],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.USE_TOOL
		},
		{
			petIds: [PetConstants.PETS.RAT],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.SMALL_BITE
		},
		{
			petIds: [PetConstants.PETS.FAIRY],
			behaviorId: FightConstants.FIGHT_ACTIONS.PET.FAIRY_HEAL
		}
	];

	static readonly PET_FOOD_LOVE_POINTS_AMOUNT = [
		1,
		3,
		3,
		5
	];

	static FLYING_PETS = [
		PetConstants.PETS.BIRD,
		PetConstants.PETS.DUCK,
		PetConstants.PETS.OWL,
		PetConstants.PETS.BAT,
		PetConstants.PETS.SWAN,
		PetConstants.PETS.FLAMINGO,
		PetConstants.PETS.PARROT,
		PetConstants.PETS.EAGLE,
		PetConstants.PETS.DOVE,
		PetConstants.PETS.DRAGON,
		PetConstants.PETS.SCARLET_DUCK,
		PetConstants.PETS.BLACK_BIRD,
		PetConstants.PETS.RAVEN,
		PetConstants.PETS.PHOENIX,
		PetConstants.PETS.FAIRY
	];

	static SEX = {
		MALE: "m",
		FEMALE: "f"
	};
}

export const PostFightPetLoveOutcomes = {
	WIN: "win",
	LOSS: "loss"
} as const;

export type PostFightPetLoveOutcome = typeof PostFightPetLoveOutcomes[keyof typeof PostFightPetLoveOutcomes];

export type PostFightPetReactionType = typeof PetConstants.POST_FIGHT_REACTION_TYPES[keyof typeof PetConstants.POST_FIGHT_REACTION_TYPES];

/**
 * Type representing a pet food type
 */
export type PetFood = typeof PetConstants.PET_FOOD[keyof typeof PetConstants.PET_FOOD];

export enum PET_ENTITY_GIVE_RETURN {
	NO_SLOT,
	GUILD,
	PLAYER
}
