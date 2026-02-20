import { MaterialRarity } from "../types/MaterialRarity";

export type EquipAction = typeof ItemConstants.EQUIP_ACTIONS[keyof typeof ItemConstants.EQUIP_ACTIONS];
export type EquipError = typeof ItemConstants.EQUIP_ERRORS[keyof typeof ItemConstants.EQUIP_ERRORS];

export enum ItemCategory {
	WEAPON,
	ARMOR,
	POTION,
	OBJECT
}

export function itemCategoryToString(category: ItemCategory): string {
	switch (category) {
		case ItemCategory.WEAPON:
			return "weapons";
		case ItemCategory.ARMOR:
			return "armors";
		case ItemCategory.POTION:
			return "potions";
		default:
			return "objects";
	}
}

export enum ItemRarity {
	BASIC,
	COMMON,
	UNCOMMON,
	EXOTIC,
	RARE,
	SPECIAL,
	EPIC,
	LEGENDARY,
	MYTHICAL
}

export enum ItemNature {
	NONE,
	HEALTH,
	SPEED,
	ATTACK,
	DEFENSE,
	TIME_SPEEDUP,
	MONEY,
	ENERGY
}

export const FightItemNatures = [
	ItemNature.ATTACK,
	ItemNature.DEFENSE,
	ItemNature.SPEED
];

export abstract class ItemConstants {
	static readonly SLOTS = {
		LIMITS: [
			2,
			2,
			4,
			4
		],
		PRICES: [
			500,
			1000,
			2500,
			7000,
			12000,
			17000,
			25000,
			30000
		]
	};

	static readonly RARITY = {
		BASIC: 0,
		COMMON: 1,
		UNCOMMON: 2,
		EXOTIC: 3,
		RARE: 4,
		SPECIAL: 5,
		EPIC: 6,
		LEGENDARY: 7,
		MYTHICAL: 8,

		VALUES: [
			0, // Basic
			20, // Common
			40, // Uncommon
			100, // Exotic
			250, // Rare
			580, // Special
			1690, // Epic
			5000, // Legendary
			10000 // Mythic
		],

		GENERATOR: {
			VALUES: [ // Common
				4375, // Uncommon
				6875, // Exotic
				8375, // Rare
				9375, // Special
				9875, // Epic
				9975, // Legendary
				9998, // Mythic
				10000
			],
			MAX_VALUE: 10000 // Be sure this number is the same as the last value in the VALUES array
		}
	};

	static readonly TAGS = { HOLY: "holy" };

	static readonly NATURE_ID_TO_NAME = [
		"none",
		"health",
		"speed",
		"attack",
		"defense",
		"time",
		"money",
		"energy"
	];

	static readonly UPGRADE_LEVEL_STATS_MULTIPLIER = [
		1,
		1.05,
		1.1,
		1.16,
		1.23,
		1.32
	];

	static MAX_UPGRADE_LEVEL = 5;

	/**
	 * Maximum level that can be upgraded at home (levels 0-1 can be upgraded to 1-2)
	 * Higher levels require the blacksmith
	 */
	static MAX_UPGRADE_LEVEL_AT_HOME = 2;

	static readonly UPGRADE_MATERIALS_PER_ITEM_RARITY_AND_LEVEL: {
		[rarity in ItemRarity]: {
			1: {
				[materialRarity in MaterialRarity]: number
			};
			2: {
				[materialRarity in MaterialRarity]: number
			};
			3: {
				[materialRarity in MaterialRarity]: number
			};
			4: {
				[materialRarity in MaterialRarity]: number
			};
			5: {
				[materialRarity in MaterialRarity]: number
			};
		};
	} = {
		[ItemRarity.BASIC]: {
			1: {
				[MaterialRarity.COMMON]: 0,
				[MaterialRarity.UNCOMMON]: 0,
				[MaterialRarity.RARE]: 0
			},
			2: {
				[MaterialRarity.COMMON]: 0,
				[MaterialRarity.UNCOMMON]: 0,
				[MaterialRarity.RARE]: 0
			},
			3: {
				[MaterialRarity.COMMON]: 0,
				[MaterialRarity.UNCOMMON]: 0,
				[MaterialRarity.RARE]: 0
			},
			4: {
				[MaterialRarity.COMMON]: 0,
				[MaterialRarity.UNCOMMON]: 0,
				[MaterialRarity.RARE]: 0
			},
			5: {
				[MaterialRarity.COMMON]: 0,
				[MaterialRarity.UNCOMMON]: 0,
				[MaterialRarity.RARE]: 0
			}
		},
		[ItemRarity.COMMON]: {
			1: {
				[MaterialRarity.COMMON]: 2,
				[MaterialRarity.UNCOMMON]: 0,
				[MaterialRarity.RARE]: 0
			},
			2: {
				[MaterialRarity.COMMON]: 3,
				[MaterialRarity.UNCOMMON]: 0,
				[MaterialRarity.RARE]: 0
			},
			3: {
				[MaterialRarity.COMMON]: 4,
				[MaterialRarity.UNCOMMON]: 0,
				[MaterialRarity.RARE]: 0
			},
			4: {
				[MaterialRarity.COMMON]: 5,
				[MaterialRarity.UNCOMMON]: 0,
				[MaterialRarity.RARE]: 0
			},
			5: {
				[MaterialRarity.COMMON]: 6,
				[MaterialRarity.UNCOMMON]: 0,
				[MaterialRarity.RARE]: 0
			}
		},
		[ItemRarity.UNCOMMON]: {
			1: {
				[MaterialRarity.COMMON]: 2,
				[MaterialRarity.UNCOMMON]: 0,
				[MaterialRarity.RARE]: 0
			},
			2: {
				[MaterialRarity.COMMON]: 4,
				[MaterialRarity.UNCOMMON]: 0,
				[MaterialRarity.RARE]: 0
			},
			3: {
				[MaterialRarity.COMMON]: 5,
				[MaterialRarity.UNCOMMON]: 1,
				[MaterialRarity.RARE]: 0
			},
			4: {
				[MaterialRarity.COMMON]: 6,
				[MaterialRarity.UNCOMMON]: 2,
				[MaterialRarity.RARE]: 0
			},
			5: {
				[MaterialRarity.COMMON]: 6,
				[MaterialRarity.UNCOMMON]: 4,
				[MaterialRarity.RARE]: 0
			}
		},
		[ItemRarity.EXOTIC]: {
			1: {
				[MaterialRarity.COMMON]: 3,
				[MaterialRarity.UNCOMMON]: 0,
				[MaterialRarity.RARE]: 0
			},
			2: {
				[MaterialRarity.COMMON]: 4,
				[MaterialRarity.UNCOMMON]: 1,
				[MaterialRarity.RARE]: 0
			},
			3: {
				[MaterialRarity.COMMON]: 5,
				[MaterialRarity.UNCOMMON]: 3,
				[MaterialRarity.RARE]: 0
			},
			4: {
				[MaterialRarity.COMMON]: 6,
				[MaterialRarity.UNCOMMON]: 5,
				[MaterialRarity.RARE]: 0
			},
			5: {
				[MaterialRarity.COMMON]: 8,
				[MaterialRarity.UNCOMMON]: 5,
				[MaterialRarity.RARE]: 1
			}
		},
		[ItemRarity.RARE]: {
			1: {
				[MaterialRarity.COMMON]: 5,
				[MaterialRarity.UNCOMMON]: 0,
				[MaterialRarity.RARE]: 0
			},
			2: {
				[MaterialRarity.COMMON]: 6,
				[MaterialRarity.UNCOMMON]: 2,
				[MaterialRarity.RARE]: 0
			},
			3: {
				[MaterialRarity.COMMON]: 7,
				[MaterialRarity.UNCOMMON]: 3,
				[MaterialRarity.RARE]: 1
			},
			4: {
				[MaterialRarity.COMMON]: 8,
				[MaterialRarity.UNCOMMON]: 4,
				[MaterialRarity.RARE]: 2
			},
			5: {
				[MaterialRarity.COMMON]: 9,
				[MaterialRarity.UNCOMMON]: 5,
				[MaterialRarity.RARE]: 3
			}
		},
		[ItemRarity.SPECIAL]: {
			1: {
				[MaterialRarity.COMMON]: 8,
				[MaterialRarity.UNCOMMON]: 2,
				[MaterialRarity.RARE]: 0
			},
			2: {
				[MaterialRarity.COMMON]: 9,
				[MaterialRarity.UNCOMMON]: 4,
				[MaterialRarity.RARE]: 1
			},
			3: {
				[MaterialRarity.COMMON]: 10,
				[MaterialRarity.UNCOMMON]: 5,
				[MaterialRarity.RARE]: 2
			},
			4: {
				[MaterialRarity.COMMON]: 11,
				[MaterialRarity.UNCOMMON]: 6,
				[MaterialRarity.RARE]: 3
			},
			5: {
				[MaterialRarity.COMMON]: 12,
				[MaterialRarity.UNCOMMON]: 7,
				[MaterialRarity.RARE]: 5
			}
		},
		[ItemRarity.EPIC]: {
			1: {
				[MaterialRarity.COMMON]: 8,
				[MaterialRarity.UNCOMMON]: 2,
				[MaterialRarity.RARE]: 3
			},
			2: {
				[MaterialRarity.COMMON]: 9,
				[MaterialRarity.UNCOMMON]: 4,
				[MaterialRarity.RARE]: 5
			},
			3: {
				[MaterialRarity.COMMON]: 10,
				[MaterialRarity.UNCOMMON]: 5,
				[MaterialRarity.RARE]: 7
			},
			4: {
				[MaterialRarity.COMMON]: 11,
				[MaterialRarity.UNCOMMON]: 6,
				[MaterialRarity.RARE]: 9
			},
			5: {
				[MaterialRarity.COMMON]: 12,
				[MaterialRarity.UNCOMMON]: 7,
				[MaterialRarity.RARE]: 12
			}
		},
		[ItemRarity.LEGENDARY]: {
			1: {
				[MaterialRarity.COMMON]: 10,
				[MaterialRarity.UNCOMMON]: 5,
				[MaterialRarity.RARE]: 5
			},
			2: {
				[MaterialRarity.COMMON]: 15,
				[MaterialRarity.UNCOMMON]: 10,
				[MaterialRarity.RARE]: 8
			},
			3: {
				[MaterialRarity.COMMON]: 20,
				[MaterialRarity.UNCOMMON]: 15,
				[MaterialRarity.RARE]: 12
			},
			4: {
				[MaterialRarity.COMMON]: 25,
				[MaterialRarity.UNCOMMON]: 20,
				[MaterialRarity.RARE]: 15
			},
			5: {
				[MaterialRarity.COMMON]: 30,
				[MaterialRarity.UNCOMMON]: 25,
				[MaterialRarity.RARE]: 20
			}
		},
		[ItemRarity.MYTHICAL]: {
			1: {
				[MaterialRarity.COMMON]: 15,
				[MaterialRarity.UNCOMMON]: 10,
				[MaterialRarity.RARE]: 10
			},
			2: {
				[MaterialRarity.COMMON]: 20,
				[MaterialRarity.UNCOMMON]: 15,
				[MaterialRarity.RARE]: 15
			},
			3: {
				[MaterialRarity.COMMON]: 25,
				[MaterialRarity.UNCOMMON]: 20,
				[MaterialRarity.RARE]: 20
			},
			4: {
				[MaterialRarity.COMMON]: 30,
				[MaterialRarity.UNCOMMON]: 25,
				[MaterialRarity.RARE]: 25
			},
			5: {
				[MaterialRarity.COMMON]: 40,
				[MaterialRarity.UNCOMMON]: 30,
				[MaterialRarity.RARE]: 30
			}
		}
	};

	static readonly EQUIP_ACTIONS = {
		EQUIP: "equip",
		DEPOSIT: "deposit"
	} as const;

	static readonly EQUIP_ERRORS = {
		INVALID: "invalid",
		NO_ITEM: "noItem",
		RESERVE_FULL: "reserveFull"
	} as const;
}
