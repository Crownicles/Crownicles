import { MaterialRarity } from "../types/MaterialRarity";
import { ItemRarity } from "./ItemConstants";
import { RandomUtils } from "../utils/RandomUtils";

/**
 * Item material category id (1..15).
 * Each weapon and armor belongs to exactly one category. The category drives the
 * pool of materials used to upgrade the item at the blacksmith.
 *
 * The pools themselves live in `Core/resources/itemMaterialCategories/<id>.json`
 * (loaded by `ItemMaterialCategoryDataController`). Their composition
 * (7 COMMON + 7 UNCOMMON + 6 RARE = 20 materials per category) and the
 * per-material category counts (every material belongs to 3 or 4 categories)
 * are validated by `Core/__tests__/core/data/ItemMaterialCategoryPools.test.ts`.
 *
 * The weapon/armor -> category assignment is documented in the Tools repo
 * (`other/item-material-categories.md`) and checked by
 * `other/verify-item-material-categories.py`.
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
 * Multiplier applied to the item id when combining it with the material rarity
 * to build the per-(item, material-rarity) shuffle seed. A small prime keeps
 * close item ids well separated in the seed space.
 */
const POOL_SEED_ITEM_ID_MULTIPLIER = 31;

/**
 * Pick `distinctCount` distinct material ids from a per-category sub-pool,
 * deterministically by `itemId`. The sliding window shifts by one slot between
 * consecutive levels so that two consecutive upgrades share
 * `max(0, distinctCount - 1)` materials and change at most one material.
 *
 * With this 1-slot shift and the chosen pool sizes (7 for COMMON and UNCOMMON,
 * 6 for RARE), 5 upgrades cover the whole sub-pool.
 *
 * Wraps around the permutation when `start + k` overflows.
 */
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
	const perm = RandomUtils.deterministicShuffle([...subPool], itemId * POOL_SEED_ITEM_ID_MULTIPLIER + matRarity);
	const start = (level - 1) % perm.length;
	const out: number[] = [];
	for (let i = 0; i < k; i++) {
		out.push(perm[(start + i) % perm.length]);
	}
	return out;
}
