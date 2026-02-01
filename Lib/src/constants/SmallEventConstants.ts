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
		},

		SLEEPING_PROBABILITY: 0.5
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
		},

		/**
		 * Strategy configurations for the goblets game
		 * Each strategy has different probabilities and multipliers
		 */
		STRATEGIES: {
			/**
			 * Classic: Same behavior as before
			 * 33% life, 33% time, 33% nothing
			 */
			CLASSIC: {
				NOTHING_CHANCE: 1 / 3,
				ITEM_CHANCE: 0,
				MALUS_MULTIPLIER: 1
			},

			/**
			 * Risky: 2% chance for epic/legendary/mythic item, but only 10% nothing
			 * 10% nothing, 2% item, rest is split between life and time
			 */
			RISKY: {
				NOTHING_CHANCE: 0.10,
				ITEM_CHANCE: 0.02,
				MALUS_MULTIPLIER: 1
			},

			/**
			 * Safe: Always a malus, but 33% weaker
			 * 0% nothing, 50% life, 50% time (with 0.67 multiplier)
			 */
			SAFE: {
				NOTHING_CHANCE: 0,
				ITEM_CHANCE: 0,
				MALUS_MULTIPLIER: 2 / 3
			},

			/**
			 * Gambler: 90% nothing, but malus are 3.3x stronger
			 * 80% nothing, 10% life, 10% time (with 3.3 multiplier)
			 */
			GAMBLER: {
				NOTHING_CHANCE: 0.80,
				ITEM_CHANCE: 0,
				MALUS_MULTIPLIER: 3.3
			}
		},

		// Minimum level to allow EPIC as a minimum rarity in the goblets game
		MIN_LEVEL_FOR_EPIC_ITEM: 100
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
			FEISTY_PET: "petIsFeisty",
			CLONE_PET: "petIsClone",
			CLONE_PET_ALREADY_SEEN: "clonePetAlreadySeen"
		}
	};

	static readonly PET_FOOD = {
		SMALL_EVENT_NAME: "petFood",
		OUTCOMES: {
			FOUND_BY_PLAYER: "found_by_player",
			FOUND_BY_PET: "found_by_pet",
			FOUND_ANYWAY: "found_anyway",
			NOTHING: "nothing",
			PLAYER_FAILED: "player_failed",
			PET_FAILED: "pet_failed"
		},
		BUTTON_IDS: {
			INVESTIGATE: "investigate",
			SEND_PET: "pet",
			CONTINUE: "continue"
		},
		LOVE_CHANGE_TYPES: {
			PLUS: "plus",
			MINUS: "minus",
			NEUTRAL: "neutral"
		},
		TRANSLATION_SUFFIX: { SOUP: "_soup" },
		TRAVEL_TIME_PENALTY_MINUTES: 5,
		NO_LOVE_CHANGE: 0,
		FEED_DELAY_MULTIPLIER: 3,
		DECAY_FACTOR: 0.003,
		MIN_PROBABILITY: 0.1,
		MAX_PROBABILITY: 1.0,

		// Map location types that affect food type probabilities
		BAD_SMELL_TYPES: ["de", "mo"],

		// Map location types where vegetarian food is more likely
		VEGETARIAN_TYPES: [
			"fo",
			"pl",
			"ro"
		],

		// Map location types where meat is more likely
		MEAT_TYPES: [
			"ri",
			"be",
			"la"
		],

		// Map location types where good smelling food is more likely
		GOOD_SMELL_TYPES: [
			"vi",
			"ci",
			"castleEntrance",
			"castleThrone"
		],
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

	static readonly BAD_PET = {
		SMALL_EVENT_NAME: "badPet",
		ACTIONS_TO_SHOW: 3,
		ACTION_IDS: {
			INTIMIDATE: "intimidate",
			PLEAD: "plead",
			GIVE_MEAT: "giveMeat",
			GIVE_VEG: "giveVeg",
			FLEE: "flee",
			HIDE: "hide",
			WAIT: "wait",
			PROTECT: "protect",
			DISTRACT: "distract",
			CALM: "calm",
			IMPOSER: "imposer",
			ENERGIZE: "energize"
		} as const,
		OUTCOME_TYPES: {
			GIVE_MEAT_NO_FOOD: "giveMeatNoFood",
			GIVE_MEAT_LIKES: "giveMeatLikes",
			GIVE_MEAT_DISLIKES: "giveMeatDislikes",
			GIVE_VEG_NO_FOOD: "giveVegNoFood",
			GIVE_VEG_LIKES: "giveVegLikes",
			GIVE_VEG_DISLIKES: "giveVegDislikes"
		} as const,
		LOVE_LOST: {
			INTIMIDATE: {
				STRONG_MIN: 0,
				STRONG_MAX: 3,
				WEAK_MIN: 1,
				WEAK_MAX: 9
			},
			PLEAD: {
				WEAK_MIN: 0,
				WEAK_MAX: 3,
				STRONG_MIN: 1,
				STRONG_MAX: 8
			},
			GIVE_FOOD: {
				NO_FOOD: 5,
				JEALOUS_MIN: 1,
				JEALOUS_MAX: 6,
				DISLIKES_CHANCE: 0.2,
				DISLIKES_AMOUNT: 1
			},
			FLEE: {
				MIN: 1,
				MAX: 11
			},
			HIDE: {
				MIN: 1,
				MAX: 6
			},
			WAIT: 2,
			PROTECT: {
				FAIL_MIN: 1,
				FAIL_MAX: 4
			},
			DISTRACT: {
				FAIL_MIN: 1,
				FAIL_MAX: 8
			},
			CALM: {
				BASE_SUCCESS_CHANCE: 0.3,
				LOVE_BONUS_MULTIPLIER: 0.6,
				FAIL_MIN: 4,
				FAIL_MAX: 7
			},
			IMPOSER: {
				BASE_SUCCESS_CHANCE: 0.2,
				RARITY_BONUS: 0.1,
				FAIL_MIN: 3,
				FAIL_MAX: 6
			},
			ENERGIZE: {
				BASE_SUCCESS_CHANCE: 0.15,
				VIGOR_BONUS_MULTIPLIER: 0.75,
				FAIL_MIN: 4,
				FAIL_MAX: 8
			}
		},
		THRESHOLDS: {
			PET_FORCE_STRONG: 16,
			PLAYER_SPEED_FAST: 400,
			FLEE_SUCCESS_CHANCE_FAST: 0.7,
			PET_FORCE_WEAK: 5,
			HIDE_SUCCESS_CHANCE_WEAK: 0.3,
			PLAYER_DEFENSE_MAX: 500,
			PROTECT_MAX_SUCCESS_CHANCE: 0.7,
			DISTRACT_SUCCESS_CHANCE: 0.5
		}
	};

	static readonly EXPEDITION_ADVICE = {
		SMALL_EVENT_NAME: "expeditionAdvice",
		PHASES: {
			INTRO: "intro",
			EXPLANATION: "explanation",
			CONDITIONS: "conditions"
		}
	} as const;

	static readonly FIND_MATERIAL = {
		SMALL_EVENT_NAME: "findMaterial",
		RARE_PROBABILITY: 0.1,
		UNCOMMON_PROBABILITY: 0.3
	} as const;
}
