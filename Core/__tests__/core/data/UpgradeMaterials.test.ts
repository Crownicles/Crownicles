import { describe, expect, it } from "vitest";
import { Weapon } from "../../../src/data/Weapon";
import { ItemConstants, ItemRarity } from "../../../../Lib/src/constants/ItemConstants";
import {
	ITEM_MATERIAL_CATEGORY_IDS,
	ItemMaterialCategory
} from "../../../../Lib/src/constants/ItemMaterialCategoryConstants";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { Material, MaterialDataController } from "../../../src/data/Material";
import { ItemMaterialCategoryDataController } from "../../../src/data/ItemMaterialCategory";
import { ItemUpgradeMaterialCountDataController } from "../../../src/data/ItemUpgradeMaterialCount";

type WritableWeaponProps = {
	id: number;
	rarity: ItemRarity;
	materialCategory: ItemMaterialCategory;
};

class TestWeapon extends Weapon {
	public setProps(p: { id: number; rarity: ItemRarity; category: ItemMaterialCategory }): void {
		const writable = this as unknown as WritableWeaponProps;
		writable.id = p.id;
		writable.rarity = p.rarity;
		writable.materialCategory = p.category;
	}
}

function makeWeapon(id: number, rarity: ItemRarity, category: ItemMaterialCategory): TestWeapon {
	const w = new TestWeapon();
	w.setProps({ id, rarity, category });
	return w;
}

function aggregate(mats: Material[]): { byId: Map<string, number>; byRarity: Record<MaterialRarity, number> } {
	const byId = new Map<string, number>();
	const byRarity = {
		[MaterialRarity.COMMON]: 0,
		[MaterialRarity.UNCOMMON]: 0,
		[MaterialRarity.RARE]: 0
	};
	for (const m of mats) {
		byId.set(m.id, (byId.get(m.id) ?? 0) + 1);
		byRarity[m.rarity] += 1;
	}
	return { byId, byRarity };
}

describe("MainItem.getUpgradeMaterials (15-category system)", () => {
	it("returns no materials for BASIC items at any level", () => {
		const w = makeWeapon(7, ItemRarity.BASIC, 5);
		for (let lvl = 0; lvl <= ItemConstants.MAX_UPGRADE_LEVEL; lvl++) {
			expect(w.getUpgradeMaterials(lvl)).toEqual([]);
		}
	});

	it("returns no materials at level 0 even for non-BASIC items", () => {
		const w = makeWeapon(1, ItemRarity.MYTHICAL, 11);
		expect(w.getUpgradeMaterials(0)).toEqual([]);
	});

	it("clamps levels above MAX_UPGRADE_LEVEL to max", () => {
		const w = makeWeapon(1, ItemRarity.RARE, 3);
		const maxMats = w.getUpgradeMaterials(ItemConstants.MAX_UPGRADE_LEVEL);
		const overMats = w.getUpgradeMaterials(ItemConstants.MAX_UPGRADE_LEVEL + 5);
		// Same aggregated quantities (Material instances may differ between calls due to cache)
		expect(overMats.length).toBe(maxMats.length);
	});

	it("matches ItemConstants.UPGRADE_MATERIALS_PER_ITEM_RARITY_AND_LEVEL totals per rarity bucket", () => {
		const w = makeWeapon(42, ItemRarity.LEGENDARY, 14);
		for (let lvl = 1; lvl <= 5; lvl++) {
			const { byRarity } = aggregate(w.getUpgradeMaterials(lvl));
			const expected = ItemConstants.UPGRADE_MATERIALS_PER_ITEM_RARITY_AND_LEVEL[ItemRarity.LEGENDARY][lvl as 1 | 2 | 3 | 4 | 5];
			expect(byRarity[MaterialRarity.COMMON]).toBe(expected[MaterialRarity.COMMON]);
			expect(byRarity[MaterialRarity.UNCOMMON]).toBe(expected[MaterialRarity.UNCOMMON]);
			expect(byRarity[MaterialRarity.RARE]).toBe(expected[MaterialRarity.RARE]);
		}
	});

	it("returns at most 10 distinct materials per upgrade (cahier des charges cap)", () => {
		// Pick a few representative items
		const cases: Array<[ItemRarity, ItemMaterialCategory]> = [
			[ItemRarity.RARE, 1], [ItemRarity.SPECIAL, 6], [ItemRarity.EPIC, 10],
			[ItemRarity.LEGENDARY, 14], [ItemRarity.MYTHICAL, 15]
		];
		for (const [r, cat] of cases) {
			for (let id = 1; id <= 20; id++) {
				const w = makeWeapon(id, r, cat);
				for (let lvl = 1; lvl <= 5; lvl++) {
					const { byId } = aggregate(w.getUpgradeMaterials(lvl));
					expect(byId.size).toBeLessThanOrEqual(10);
				}
			}
		}
	});

	it("rotates 1 to 5 materials between consecutive levels", () => {
		for (const cat of ITEM_MATERIAL_CATEGORY_IDS) {
			for (const r of [ItemRarity.RARE, ItemRarity.EPIC, ItemRarity.LEGENDARY, ItemRarity.MYTHICAL]) {
				const w = makeWeapon(13, r, cat);
				const sets: Set<string>[] = [];
				for (let lvl = 1; lvl <= 5; lvl++) {
					sets.push(new Set(w.getUpgradeMaterials(lvl).map(m => m.id)));
				}
				for (let i = 0; i < 4; i++) {
					const removed = [...sets[i]].filter(x => !sets[i + 1].has(x)).length;
					const added = [...sets[i + 1]].filter(x => !sets[i].has(x)).length;
					expect(Math.max(removed, added)).toBeLessThanOrEqual(5);
					expect(Math.max(removed, added)).toBeGreaterThanOrEqual(1);
				}
			}
		}
	});

	it("draws materials only from the item's category pool", () => {
		for (const cat of ITEM_MATERIAL_CATEGORY_IDS) {
			const pool = ItemMaterialCategoryDataController.instance.getPool(cat)!;
			const allowed = new Set<string>();
			for (const r of [MaterialRarity.COMMON, MaterialRarity.UNCOMMON, MaterialRarity.RARE]) {
				for (const id of pool.getMaterialsForRarity(r)) {
					allowed.add(String(id));
				}
			}
			const w = makeWeapon(5, ItemRarity.MYTHICAL, cat);
			for (let lvl = 1; lvl <= 5; lvl++) {
				for (const m of w.getUpgradeMaterials(lvl)) {
					expect(allowed.has(m.id)).toBe(true);
				}
			}
		}
	});

	it("is deterministic: two calls return the same aggregated quantities", () => {
		const w1 = makeWeapon(77, ItemRarity.MYTHICAL, 11);
		const w2 = makeWeapon(77, ItemRarity.MYTHICAL, 11);
		for (let lvl = 1; lvl <= 5; lvl++) {
			const a = aggregate(w1.getUpgradeMaterials(lvl));
			const b = aggregate(w2.getUpgradeMaterials(lvl));
			expect([...a.byId.entries()].sort()).toEqual([...b.byId.entries()].sort());
		}
	});

	it("uses the distinct-count table for the actual number of unique mats picked per bucket", () => {
		const w = makeWeapon(33, ItemRarity.EPIC, 7);
		for (let lvl = 1; lvl <= 5; lvl++) {
			const mats = w.getUpgradeMaterials(lvl);
			const distinctCounts = ItemUpgradeMaterialCountDataController.instance.getForItemRarity(ItemRarity.EPIC)!;
			const totals = ItemConstants.UPGRADE_MATERIALS_PER_ITEM_RARITY_AND_LEVEL[ItemRarity.EPIC][lvl as 1 | 2 | 3 | 4 | 5];
			const byRarityIds: Record<MaterialRarity, Set<string>> = {
				[MaterialRarity.COMMON]: new Set(),
				[MaterialRarity.UNCOMMON]: new Set(),
				[MaterialRarity.RARE]: new Set()
			};
			for (const m of mats) {
				byRarityIds[m.rarity].add(m.id);
			}
			for (const rar of [MaterialRarity.COMMON, MaterialRarity.UNCOMMON, MaterialRarity.RARE]) {
				const pool = ItemMaterialCategoryDataController.instance.getPool(7)!.getMaterialsForRarity(rar);
				const expectedDistinct = Math.min(distinctCounts.getDistinctCount(lvl, rar), pool.length, totals[rar]);
				expect(byRarityIds[rar].size).toBe(expectedDistinct);
			}
		}
	});
});

describe("MainItem.getUpgradeMaterials with real Material data", () => {
	it("resolves every picked material id from MaterialDataController", () => {
		// All 90 materials should be loaded; every pool id (1..90) must resolve.
		for (let id = 1; id <= 90; id++) {
			const m = MaterialDataController.instance.getById(String(id));
			expect(m, `material ${id} missing in DataController`).toBeDefined();
		}
		const w = makeWeapon(1, ItemRarity.MYTHICAL, 14);
		const mats = w.getUpgradeMaterials(5);
		expect(mats.length).toBeGreaterThan(0);
		for (const m of mats) {
			expect(m).toBeInstanceOf(Material);
		}
	});
});
