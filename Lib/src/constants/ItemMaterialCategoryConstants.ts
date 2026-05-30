import { MaterialRarity } from "../types/MaterialRarity";
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
// The union type must be enumerated manually (TypeScript cannot express a numeric range type).
export type ItemMaterialCategory = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export const ITEM_MATERIAL_CATEGORY_COUNT = 15;

export const ITEM_MATERIAL_CATEGORY_IDS: readonly ItemMaterialCategory[]
	= Array.from({ length: ITEM_MATERIAL_CATEGORY_COUNT }, (_, index) => (index + 1) as ItemMaterialCategory);

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
