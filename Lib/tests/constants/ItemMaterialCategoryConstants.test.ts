import { describe, expect, it } from "vitest";
import {
	DISTINCT_MATERIALS_PER_ITEM_RARITY_AND_LEVEL,
	ITEM_MATERIAL_CATEGORY_IDS,
	pickDistinctMaterials
} from "../../src/constants/ItemMaterialCategoryConstants";
import { ItemRarity } from "../../src/constants/ItemConstants";
import { MaterialRarity } from "../../src/types/MaterialRarity";

describe("ItemMaterialCategoryConstants", () => {
	it("exposes 15 category ids", () => {
		expect(ITEM_MATERIAL_CATEGORY_IDS).toHaveLength(15);
		expect([...ITEM_MATERIAL_CATEGORY_IDS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
	});

	describe("DISTINCT_MATERIALS_PER_ITEM_RARITY_AND_LEVEL", () => {
		it("never exceeds the pool size of its rarity bucket", () => {
			for (const itemRarity of Object.values(ItemRarity).filter(v => typeof v === "number") as ItemRarity[]) {
				const rows = DISTINCT_MATERIALS_PER_ITEM_RARITY_AND_LEVEL[itemRarity];
				expect(rows).toHaveLength(5);
				for (const row of rows) {
					expect(row[MaterialRarity.COMMON]).toBeLessThanOrEqual(7);
					expect(row[MaterialRarity.UNCOMMON]).toBeLessThanOrEqual(7);
					expect(row[MaterialRarity.RARE]).toBeLessThanOrEqual(6);
				}
			}
		});

		it("totals 0 for BASIC and at most 10 distinct mats per upgrade", () => {
			for (const itemRarity of Object.values(ItemRarity).filter(v => typeof v === "number") as ItemRarity[]) {
				const rows = DISTINCT_MATERIALS_PER_ITEM_RARITY_AND_LEVEL[itemRarity];
				for (const row of rows) {
					const total = row[MaterialRarity.COMMON] + row[MaterialRarity.UNCOMMON] + row[MaterialRarity.RARE];
					if (itemRarity === ItemRarity.BASIC) {
						expect(total).toBe(0);
					}
					else {
						expect(total).toBeGreaterThanOrEqual(2);
						expect(total).toBeLessThanOrEqual(10);
					}
				}
			}
		});
	});

	describe("deterministic shuffle (via pickDistinctMaterials)", () => {
		it("returns a permutation (same elements, possibly reordered) without mutating input", () => {
			const pool = [10, 20, 30, 40, 50, 60, 70];
			const original = [...pool];
			const perm = pickDistinctMaterials(pool, 12345, MaterialRarity.COMMON, 1, pool.length);
			expect(pool).toEqual(original);
			expect([...perm].sort((a, b) => a - b)).toEqual([...pool].sort((a, b) => a - b));
		});

		it("is deterministic for a given seed", () => {
			const pool = [1, 2, 3, 4, 5, 6, 7];
			expect(pickDistinctMaterials(pool, 42, MaterialRarity.COMMON, 1, pool.length))
				.toEqual(pickDistinctMaterials(pool, 42, MaterialRarity.COMMON, 1, pool.length));
		});

		it("produces different orders for different seeds (most of the time)", () => {
			const pool = [1, 2, 3, 4, 5, 6, 7];
			let differs = 0;
			for (let i = 0; i < 20; i++) {
				const a = pickDistinctMaterials(pool, i, MaterialRarity.COMMON, 1, pool.length);
				const b = pickDistinctMaterials(pool, i + 100, MaterialRarity.COMMON, 1, pool.length);
				if (JSON.stringify(a) !== JSON.stringify(b)) {
					differs++;
				}
			}
			expect(differs).toBeGreaterThan(15);
		});
	});

	describe("pickDistinctMaterials", () => {
		it("returns empty when distinctCount <= 0 or pool empty", () => {
			expect(pickDistinctMaterials([1, 2, 3], 5, MaterialRarity.COMMON, 1, 0)).toEqual([]);
			expect(pickDistinctMaterials([], 5, MaterialRarity.COMMON, 1, 3)).toEqual([]);
		});

		it("returns exactly distinctCount items (capped by pool size)", () => {
			const pool = [1, 2, 3, 4, 5];
			expect(pickDistinctMaterials(pool, 7, MaterialRarity.COMMON, 1, 3)).toHaveLength(3);
			expect(pickDistinctMaterials(pool, 7, MaterialRarity.COMMON, 1, 99)).toHaveLength(5);
		});

		it("returned ids are distinct", () => {
			const pool = [1, 2, 3, 4, 5, 6, 7];
			for (let lvl = 1; lvl <= 5; lvl++) {
				for (let k = 1; k <= 7; k++) {
					const picked = pickDistinctMaterials(pool, 11, MaterialRarity.COMMON, lvl, k);
					expect(new Set(picked).size).toBe(picked.length);
				}
			}
		});

		it("is deterministic per (pool, itemId, matRarity, level, distinctCount)", () => {
			const pool = [10, 20, 30, 40, 50, 60, 70];
			expect(pickDistinctMaterials(pool, 42, MaterialRarity.UNCOMMON, 3, 4))
				.toEqual(pickDistinctMaterials(pool, 42, MaterialRarity.UNCOMMON, 3, 4));
		});

		it("shifts the window by one slot between consecutive levels", () => {
			const pool = [1, 2, 3, 4, 5, 6, 7];
			const k = 4;
			const l1 = pickDistinctMaterials(pool, 100, MaterialRarity.COMMON, 1, k);
			const l2 = pickDistinctMaterials(pool, 100, MaterialRarity.COMMON, 2, k);
			// With a 1-slot shift, the window moves by 1: overlap = k-1 = 3
			const overlap = l1.filter(x => l2.includes(x)).length;
			expect(overlap).toBe(Math.max(0, k - 1));
		});

		it("covers the whole pool over the 5 upgrade levels (for k+(5-1)*shift >= poolSize)", () => {
			const pool = [1, 2, 3, 4, 5, 6, 7];
			const k = 4;
			const union = new Set<number>();
			for (let lvl = 1; lvl <= 5; lvl++) {
				for (const id of pickDistinctMaterials(pool, 1, MaterialRarity.COMMON, lvl, k)) {
					union.add(id);
				}
			}
			expect(union.size).toBe(pool.length);
		});
	});
});
