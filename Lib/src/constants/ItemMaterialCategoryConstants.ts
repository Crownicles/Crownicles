import { MaterialRarity } from "../types/MaterialRarity";
import { ItemRarity } from "./ItemConstants";

/**
 * Item material category id (1..15).
 * Each weapon and armor belongs to exactly one category. The category drives the
 * pool of materials used to upgrade the item at the blacksmith.
 *
 * The pool composition (7 COMMON + 7 UNCOMMON + 6 RARE = 20 materials per
 * category) and the per-material category counts (every material belongs to
 * 3 or 4 categories) are validated by `docs/design/verify-item-material-categories.py`.
 *
 * See `docs/design/item-material-categories.md` for the design intent and the
 * theme of each category.
 */
export type ItemMaterialCategory = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export const ITEM_MATERIAL_CATEGORY_IDS: readonly ItemMaterialCategory[] = [
	1,
	2,
	3,
	4,
	5,
	6,
	7,
	8,
	9,
	10,
	11,
	12,
	13,
	14,
	15
] as const;

/**
 * Material pools per category, split by material rarity.
 *
 * Invariants enforced by tests:
 * - exactly 7 COMMON + 7 UNCOMMON + 6 RARE material ids per category
 * - every material id (1..90) appears in 3 or 4 categories
 * - the declared rarity of a material in a pool matches the material's own rarity
 */
export const MATERIAL_POOLS_PER_CATEGORY: {
	[category in ItemMaterialCategory]: {
		[rarity in MaterialRarity]: readonly number[]
	};
} = {
	1: {
		[MaterialRarity.COMMON]: [
			7,
			21,
			24,
			43,
			55,
			79,
			82
		],
		[MaterialRarity.UNCOMMON]: [
			17,
			44,
			50,
			71,
			81,
			85,
			90
		],
		[MaterialRarity.RARE]: [
			3,
			4,
			6,
			39,
			61,
			65
		]
	},
	2: {
		[MaterialRarity.COMMON]: [
			14,
			24,
			42,
			51,
			55,
			63,
			70
		],
		[MaterialRarity.UNCOMMON]: [
			2,
			13,
			26,
			45,
			49,
			81,
			88
		],
		[MaterialRarity.RARE]: [
			18,
			31,
			36,
			72,
			86,
			87
		]
	},
	3: {
		[MaterialRarity.COMMON]: [
			51,
			52,
			54,
			58,
			59,
			64,
			68
		],
		[MaterialRarity.UNCOMMON]: [
			2,
			8,
			9,
			15,
			30,
			41,
			88
		],
		[MaterialRarity.RARE]: [
			3,
			11,
			19,
			31,
			40,
			84
		]
	},
	4: {
		[MaterialRarity.COMMON]: [
			20,
			25,
			37,
			51,
			58,
			59,
			64
		],
		[MaterialRarity.UNCOMMON]: [
			2,
			8,
			9,
			45,
			47,
			49,
			88
		],
		[MaterialRarity.RARE]: [
			12,
			18,
			31,
			57,
			75,
			83
		]
	},
	5: {
		[MaterialRarity.COMMON]: [
			14,
			42,
			48,
			51,
			58,
			64,
			70
		],
		[MaterialRarity.UNCOMMON]: [
			9,
			13,
			26,
			29,
			81,
			88,
			90
		],
		[MaterialRarity.RARE]: [
			11,
			16,
			18,
			27,
			84,
			86
		]
	},
	6: {
		[MaterialRarity.COMMON]: [
			7,
			14,
			24,
			43,
			70,
			79,
			89
		],
		[MaterialRarity.UNCOMMON]: [
			13,
			30,
			50,
			71,
			81,
			85,
			90
		],
		[MaterialRarity.RARE]: [
			4,
			16,
			22,
			61,
			67,
			86
		]
	},
	7: {
		[MaterialRarity.COMMON]: [
			20,
			25,
			37,
			42,
			48,
			63,
			73
		],
		[MaterialRarity.UNCOMMON]: [
			26,
			29,
			45,
			47,
			49,
			74,
			78
		],
		[MaterialRarity.RARE]: [
			11,
			12,
			27,
			57,
			75,
			83
		]
	},
	8: {
		[MaterialRarity.COMMON]: [
			14,
			20,
			37,
			58,
			64,
			70,
			79
		],
		[MaterialRarity.UNCOMMON]: [
			2,
			9,
			45,
			47,
			78,
			85,
			90
		],
		[MaterialRarity.RARE]: [
			12,
			16,
			22,
			39,
			84,
			87
		]
	},
	9: {
		[MaterialRarity.COMMON]: [
			32,
			34,
			43,
			68,
			73,
			77,
			89
		],
		[MaterialRarity.UNCOMMON]: [
			15,
			30,
			33,
			38,
			53,
			60,
			74
		],
		[MaterialRarity.RARE]: [
			5,
			19,
			40,
			56,
			72,
			76
		]
	},
	10: {
		[MaterialRarity.COMMON]: [
			10,
			42,
			48,
			52,
			54,
			59,
			63
		],
		[MaterialRarity.UNCOMMON]: [
			8,
			15,
			29,
			38,
			41,
			66,
			78
		],
		[MaterialRarity.RARE]: [
			19,
			36,
			40,
			62,
			76,
			87
		]
	},
	11: {
		[MaterialRarity.COMMON]: [
			1,
			10,
			21,
			25,
			32,
			52,
			55
		],
		[MaterialRarity.UNCOMMON]: [
			17,
			23,
			38,
			44,
			46,
			50,
			66
		],
		[MaterialRarity.RARE]: [
			3,
			6,
			28,
			36,
			57,
			65
		]
	},
	12: {
		[MaterialRarity.COMMON]: [
			1,
			7,
			21,
			34,
			35,
			77,
			82
		],
		[MaterialRarity.UNCOMMON]: [
			13,
			23,
			33,
			44,
			46,
			53,
			80
		],
		[MaterialRarity.RARE]: [
			4,
			6,
			28,
			56,
			69,
			83
		]
	},
	13: {
		[MaterialRarity.COMMON]: [
			1,
			7,
			21,
			35,
			43,
			79,
			82
		],
		[MaterialRarity.UNCOMMON]: [
			23,
			44,
			46,
			50,
			71,
			80,
			85
		],
		[MaterialRarity.RARE]: [
			22,
			28,
			39,
			56,
			67,
			69
		]
	},
	14: {
		[MaterialRarity.COMMON]: [
			10,
			32,
			34,
			35,
			73,
			77,
			89
		],
		[MaterialRarity.UNCOMMON]: [
			17,
			33,
			53,
			60,
			66,
			74,
			80
		],
		[MaterialRarity.RARE]: [
			5,
			27,
			62,
			65,
			67,
			69
		]
	},
	15: {
		[MaterialRarity.COMMON]: [
			34,
			35,
			54,
			68,
			73,
			77,
			89
		],
		[MaterialRarity.UNCOMMON]: [
			30,
			33,
			41,
			53,
			60,
			74,
			80
		],
		[MaterialRarity.RARE]: [
			5,
			61,
			62,
			72,
			75,
			76
		]
	}
};

/**
 * Number of *distinct* materials picked for an upgrade, indexed by
 * [item rarity][upgrade level - 1][material rarity].
 *
 * Together with `ItemConstants.UPGRADE_MATERIALS_PER_ITEM_RARITY_AND_LEVEL`
 * (which gives the total quantity per rarity), this drives the recipe:
 * pick `distinct` materials from the category pool (sliding window seeded by item id, see `MainItem.getUpgradeMaterials`) then distribute `total / distinct` (with remainder spread over the first positions) on each picked material.
 *
 * The table is tuned so that the total number of distinct materials per
 * upgrade ranges from 0 (BASIC) up to about 9 (top-tier), with 1 to 5
 * materials rotated between consecutive levels.
 */
export const DISTINCT_MATERIALS_PER_ITEM_RARITY_AND_LEVEL: {
	[rarity in ItemRarity]: readonly {
		[matRarity in MaterialRarity]: number
	}[];
} = {
	[ItemRarity.BASIC]: [
		{
			[MaterialRarity.COMMON]: 0, [MaterialRarity.UNCOMMON]: 0, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 0, [MaterialRarity.UNCOMMON]: 0, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 0, [MaterialRarity.UNCOMMON]: 0, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 0, [MaterialRarity.UNCOMMON]: 0, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 0, [MaterialRarity.UNCOMMON]: 0, [MaterialRarity.RARE]: 0
		}
	],
	[ItemRarity.COMMON]: [
		{
			[MaterialRarity.COMMON]: 2, [MaterialRarity.UNCOMMON]: 0, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 3, [MaterialRarity.UNCOMMON]: 0, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 0, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 0, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 5, [MaterialRarity.UNCOMMON]: 0, [MaterialRarity.RARE]: 0
		}
	],
	[ItemRarity.UNCOMMON]: [
		{
			[MaterialRarity.COMMON]: 2, [MaterialRarity.UNCOMMON]: 0, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 3, [MaterialRarity.UNCOMMON]: 0, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 3, [MaterialRarity.UNCOMMON]: 1, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 1, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 2, [MaterialRarity.RARE]: 0
		}
	],
	[ItemRarity.EXOTIC]: [
		{
			[MaterialRarity.COMMON]: 3, [MaterialRarity.UNCOMMON]: 0, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 3, [MaterialRarity.UNCOMMON]: 1, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 1, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 2, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 2, [MaterialRarity.RARE]: 1
		}
	],
	[ItemRarity.RARE]: [
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 0, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 1, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 5, [MaterialRarity.UNCOMMON]: 1, [MaterialRarity.RARE]: 1
		},
		{
			[MaterialRarity.COMMON]: 5, [MaterialRarity.UNCOMMON]: 2, [MaterialRarity.RARE]: 1
		},
		{
			[MaterialRarity.COMMON]: 5, [MaterialRarity.UNCOMMON]: 2, [MaterialRarity.RARE]: 2
		}
	],
	[ItemRarity.SPECIAL]: [
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 1, [MaterialRarity.RARE]: 0
		},
		{
			[MaterialRarity.COMMON]: 5, [MaterialRarity.UNCOMMON]: 1, [MaterialRarity.RARE]: 1
		},
		{
			[MaterialRarity.COMMON]: 5, [MaterialRarity.UNCOMMON]: 2, [MaterialRarity.RARE]: 1
		},
		{
			[MaterialRarity.COMMON]: 5, [MaterialRarity.UNCOMMON]: 2, [MaterialRarity.RARE]: 2
		},
		{
			[MaterialRarity.COMMON]: 5, [MaterialRarity.UNCOMMON]: 2, [MaterialRarity.RARE]: 2
		}
	],
	[ItemRarity.EPIC]: [
		{
			[MaterialRarity.COMMON]: 2, [MaterialRarity.UNCOMMON]: 1, [MaterialRarity.RARE]: 1
		},
		{
			[MaterialRarity.COMMON]: 3, [MaterialRarity.UNCOMMON]: 2, [MaterialRarity.RARE]: 1
		},
		{
			[MaterialRarity.COMMON]: 3, [MaterialRarity.UNCOMMON]: 2, [MaterialRarity.RARE]: 2
		},
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 3, [MaterialRarity.RARE]: 2
		},
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 3, [MaterialRarity.RARE]: 2
		}
	],
	[ItemRarity.LEGENDARY]: [
		{
			[MaterialRarity.COMMON]: 3, [MaterialRarity.UNCOMMON]: 1, [MaterialRarity.RARE]: 1
		},
		{
			[MaterialRarity.COMMON]: 3, [MaterialRarity.UNCOMMON]: 2, [MaterialRarity.RARE]: 2
		},
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 2, [MaterialRarity.RARE]: 2
		},
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 3, [MaterialRarity.RARE]: 3
		},
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 3, [MaterialRarity.RARE]: 3
		}
	],
	[ItemRarity.MYTHICAL]: [
		{
			[MaterialRarity.COMMON]: 3, [MaterialRarity.UNCOMMON]: 2, [MaterialRarity.RARE]: 1
		},
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 2, [MaterialRarity.RARE]: 2
		},
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 3, [MaterialRarity.RARE]: 2
		},
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 3, [MaterialRarity.RARE]: 3
		},
		{
			[MaterialRarity.COMMON]: 4, [MaterialRarity.UNCOMMON]: 3, [MaterialRarity.RARE]: 3
		}
	]
};

/**
 * Deterministic 32-bit hash used to seed the per-(item, material-rarity)
 * permutation of a category pool. Two close inputs produce very different
 * outputs, which is what we want for the sliding-window selection.
 */
function hash32(seed: number): number {
	let x = seed | 0;
	x = Math.imul(x ^ x >>> 16, 0x85ebca6b);
	x = Math.imul(x ^ x >>> 13, 0xc2b2ae35);
	x ^= x >>> 16;
	return x >>> 0;
}

/**
 * Deterministic Fisher–Yates shuffle of `pool`, seeded by `seed`. Pure: the
 * input array is not mutated.
 */
export function permutePool(pool: readonly number[], seed: number): number[] {
	const out = pool.slice();
	let state = hash32(seed) || 1;
	for (let i = out.length - 1; i > 0; i--) {
		state = hash32(state + i);
		const j = state % (i + 1);
		const tmp = out[i];
		out[i] = out[j];
		out[j] = tmp;
	}
	return out;
}

/**
 * Pick `distinctCount` distinct material ids from a per-category sub-pool,
 * deterministically by `itemId`. The sliding window shifts by
 * `LEVEL_SHIFT_STEP` between consecutive levels so that two consecutive
 * upgrades share `max(0, distinctCount - LEVEL_SHIFT_STEP)` materials and
 * change `min(distinctCount, LEVEL_SHIFT_STEP)` materials.
 *
 * With `LEVEL_SHIFT_STEP` of 1 and the chosen pool sizes (7 for COMMON and
 * UNCOMMON, 6 for RARE), 5 upgrades cover the whole sub-pool.
 *
 * Wraps around the permutation when `start + k` overflows.
 */
export const LEVEL_SHIFT_STEP = 1;

export function pickDistinctMaterials(
	subPool: readonly number[],
	itemId: number,
	matRarity: MaterialRarity,
	level: number,
	distinctCount: number
): number[] {
	if (distinctCount <= 0 || subPool.length === 0) {
		return [];
	}
	const k = Math.min(distinctCount, subPool.length);
	const perm = permutePool(subPool, itemId * 31 + matRarity);
	const start = ((level - 1) * LEVEL_SHIFT_STEP) % perm.length;
	const out: number[] = [];
	for (let i = 0; i < k; i++) {
		out.push(perm[(start + i) % perm.length]);
	}
	return out;
}
