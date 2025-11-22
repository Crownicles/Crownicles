export abstract class SmallEventConstants {
	static readonly HEALTH = {
		MIN: 1,
		MAX: 4
	};

	static readonly EXPERIENCE = {
		MIN: 10,
		MAX: 35
	};

	static readonly SHOP = {
		SCAM_PROBABILITY: 0.1,
		BASE_MULTIPLIER: 0.6,
		SCAM_MULTIPLIER: 5,
		RESALE_MULTIPLIER: 0.1
	};

	static readonly GUILD_EXPERIENCE = {
		MIN: 20,
		MAX: 80
	};

	static readonly SMALL_BAD = {
		HEALTH: {
			MIN: 1,
			MAX: 5
		},

		TIME: {
			MIN: 1,
			MAX: 24
		},

		MONEY: {
			MIN: 10,
			MAX: 50
		}
	};

	static readonly BIG_BAD = {
		HEALTH: {
			MIN: 5,
			MAX: 30
		},

		MONEY: {
			MIN: 50,
			MAX: 250
		}
	};

	static readonly CLASS = {
		MONEY: {
			MIN: 50,
			MAX: 150
		},

		HEALTH: {
			MIN: 1,
			MAX: 5
		}
	};

	static readonly LOTTERY = {
		REWARDS: {
			EXPERIENCE: 40,
			MONEY: 50,
			GUILD_EXPERIENCE: 70,
			POINTS: 35
		},

		REWARD_TYPES: {
			XP: "xp",
			MONEY: "money",
			GUILD_XP: "guildXp",
			POINTS: "points"
		},

		MONEY_MALUS: 175
	};

	static readonly ULTIMATE_FOOD_MERCHANT = {
		MINIMUM_LEVEL_GOOD_PLAYER: 30,
		MONEY_WON_NO_GUILD: 20,
		ULTIMATE_FOOD: {
			MULTIPLIER: 3,
			VARIATION: 1
		},
		COMMON_FOOD: {
			MULTIPLIER: 6,
			VARIATION: 4
		},

		INTERACTIONS_NAMES: {
			ULTIMATE_FOOD: "ultimateFood",
			FULL_ULTIMATE_FOOD: "fullUltimateFood",
			COMMON_FOOD: "commonFood",
			FULL_COMMON_FOOD: "fullCommonFood",
			MONEY: "money",
			ITEM: "item"
		}
	};

	static readonly GOBLETS_GAME = {
		TIME_LOST: {
			BASE: 6,
			VARIATION: 5,
			LEVEL_MULTIPLIER: 0.42
		},

		HEALTH_LOST: {
			BASE: 5,
			VARIATION: 3,
			LEVEL_MULTIPLIER: 1 / 6,
			END_INTENSIFIER: 3 / 2,
			END_ADJUSTER: 5 / 2
		}
	};

	static readonly WITCH = {
		ACTION_TYPE: {
			NOTHING: 0,
			ADVICE: 1,
			INGREDIENT: 2
		},
		BASE_LIFE_POINTS_REMOVED_AMOUNT: 5,
		OUTCOME_TYPE: {
			BASE: 0,
			POTION: 1,
			EFFECT: 2,
			HEALTH_LOSS: 3,
			NOTHING: 4
		},
		NO_EFFECT_CHANCE: 0.25,
		MAX_PROBABILITY: 50
	};

	static readonly FIGHT_PET = {
		BASE_ACTION_AMOUNT: 2,
		LEVEL_TO_UNLOCK_NEW_ACTION: 30,
		GUILD_SCORE_REWARDS: {
			SMALL: {
				MIN: 1,
				MAX: 15
			},
			MEDIUM: {
				MIN: 15,
				MAX: 30
			},
			BIG: {
				MIN: 30,
				MAX: 50
			}
		},
		ENERGY_LOSS: {
			SMALL: {
				MIN: 10,
				MAX: 30
			},
			MEDIUM: {
				MIN: 30,
				MAX: 75
			},
			BIG: {
				MIN: 75,
				MAX: 200
			}
		},
		FIST_HIT_ATTACK_NEEDED: 50,
		FIST_HIT_HIGHER_DAMAGE_MINIMUM_RARITY: 5,
		RUN_AWAY_SPEED_BONUS_THRESHOLD: 15,
		INTIMIDATE_MAXIMUM_LEVEL: 90,
		INTIMIDATE_RARITY_MULTIPLIER: 5,
		ENERGY_BASED_ACTIONS_RARITY_MULTIPLIER: 0.05,
		DO_NOTHING_VERY_LUCKY_THRESHOLD: 0.2,
		PROTECT_DEFENSE_NEEDED: 60,
		MAXIMUM_STATS_BASED_ACTIONS_CHANCES: 0.8,
		PRAYER_CHANCE: 0.1,
		HAS_AN_HOLY_ATTACK_CHANCE: 0.2,
		LEFT_RIGHT_GOOD_SIDE_CHANCES: 0.75,
		LEFT_RIGHT_WRONG_SIDE_CHANCES: 0.25,
		LAST_DIGIT_LEFT_HANDED: 5,
		BASE_PET_FIGHTS_SUCCESS_RATE: 0.4,
		PLAYERS_RARITY_BONUS_BOOST: 1,
		MALUS_FOR_FEISTY_PETS: -3,
		BONUS_FOR_TRAINED_PETS: 1,
		MALUS_FOR_WRONG_DIET: -1,
		BONUS_FOR_RIGHT_DIET: 1,
		SUCCESS_PROBABILITY_FOR_RARITY_DIFFERENCE: 0.13,
		MAX_PROBABILITY_PET_VS_PET: 0.97,
		MIN_PROBABILITY_PET_VS_PET: 0.1


	};

	static readonly INFO_FIGHT = {
		HANDEDNESS_INFO_CHANCE: 0.01
	};

	static readonly PET = {
		MONEY: {
			MIN: 20,
			MAX: 70
		},

		HEALTH: {
			MIN: 1,
			MAX: 5
		},

		LOVE_POINTS: {
			MIN: 1,
			MAX: 3
		},

		TIME: {
			MIN: 5,
			MAX: 20
		},

		POINTS: {
			MIN: 20,
			MAX: 70
		},
		ENERGY: {
			MIN: 10,
			MAX: 250
		}
	};

	static readonly BONUS_GUILD_PVE_ISLANDS = {
		PROBABILITIES: {
			SUCCESS: 10,
			ESCAPE: 40
		}
	};

	static readonly CART = {
		// For the threshold a number between 0 and 1 (inclusive) is generated, and then we check for the highest threshold that is lower than the generated number
		TRANSPARENT_TP_THRESHOLD: 0.35, // 35% chance to have a transparent teleportation
		HIDDEN_TP_THRESHOLD: 0.65, // 30% chance to have a hidden teleportation
		SCAM_THRESHOLD: 0.8, // 15% chance to have a scam
		// 20% chance to have a transparent teleportation with lower cost
		TRANSPARENT_TP_PRICE: 1200,
		HIDDEN_TP_PRICE: 500,
		SCAM_TP_PRICE: 750,
		RANDOM_PRICE_BONUS: 0.3 // Prices have a random 30% bonus
	};

	static readonly EPIC_ITEM_SHOP = {
		GREAT_DEAL_PROBABILITY: 0.1,
		GREAT_DEAL_MULTIPLAYER: 3.5,
		BASE_MULTIPLIER: 5.5,
		ROAD_OF_WONDERS_MULTIPLIER: 1.5,
		REDUCTION_TIP_PROBABILITY: 0.2 // 20% chance to have a reduction tip
	};

	static readonly DWARF_PET_FAN = {
		NEW_PET_SEEN_REWARD: 1,
		ALL_PETS_SEEN: {
			GEM_PROBABILITY: 0.02,
			GEM_REWARD: 1,
			MONEY_REWARD: 150
		},
		INTERACTIONS_NAMES: {
			BADGE: "badge",
			NO_PET: "noPet",
			PET_ALREADY_SEEN: "petAlreadySeen",
			NEW_PET_SEEN: "newPetSeen",
			ALL_PETS_SEEN: "allPetsSeen",
			FEISTY_PET: "petIsFeisty"
		}
	};

	static readonly PET_FOOD = {
		BAD_SMELL_TYPES: ["de", "mo", "volcano", "mine", "ruins", "tundra", "icePeak", "iceBeach", "crystalCavern"],
		VEGETARIAN_TYPES: ["fo", "pl", "ro"],
		MEAT_TYPES: ["ri", "be", "la", "undergroundLake"],
		GOOD_SMELL_TYPES: ["vi", "ci", "castleEntrance", "castleThrone", "blessedDoors"],
		FOOD_TYPES: {
			BAD_SMELL: "badSmell",
			VEGETARIAN: "vegetarian",
			MEAT: "meat",
			GOOD_SMELL: "goodSmell",
			SOUP: "soup"
		},
		PROBABILITIES: {
			BAD_SMELL: {
				badSmell: 0.6,
				vegetarian: 0.2,
				meat: 0.1,
				goodSmell: 0.1
			},
			VEGETARIAN: {
				badSmell: 0.1,
				vegetarian: 0.6,
				meat: 0.2,
				goodSmell: 0.1
			},
			MEAT: {
				badSmell: 0.1,
				vegetarian: 0.2,
				meat: 0.6,
				goodSmell: 0.1
			},
			GOOD_SMELL: {
				badSmell: 0.1,
				vegetarian: 0.2,
				meat: 0.1,
				goodSmell: 0.6
			},
			DEFAULT: {
				badSmell: 0.25,
				vegetarian: 0.25,
				meat: 0.25,
				goodSmell: 0.25
			}
		}
	};
}
