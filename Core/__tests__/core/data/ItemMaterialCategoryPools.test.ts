import { describe, expect, it } from "vitest";
import { ITEM_MATERIAL_CATEGORY_IDS } from "../../../../Lib/src/constants/ItemMaterialCategoryConstants";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { ItemMaterialCategoryDataController } from "../../../src/data/ItemMaterialCategory";
import { MaterialDataController } from "../../../src/data/Material";

const RARITY_BUCKETS = [MaterialRarity.COMMON, MaterialRarity.UNCOMMON, MaterialRarity.RARE] as const;

const TOTAL_MATERIALS = 90;

describe("Item material category pools (resources/itemMaterialCategories)", () => {
	it("loads exactly the 15 expected category ids", () => {
		for (const cat of ITEM_MATERIAL_CATEGORY_IDS) {
			expect(ItemMaterialCategoryDataController.instance.getPool(cat), `pool ${cat} missing`).toBeDefined();
		}
		expect(ItemMaterialCategoryDataController.instance.getAllValues()).toHaveLength(15);
	});

	it("has 7 COMMON + 7 UNCOMMON + 6 RARE distinct ids per pool", () => {
		for (const cat of ITEM_MATERIAL_CATEGORY_IDS) {
			const pool = ItemMaterialCategoryDataController.instance.getPool(cat)!;
			expect(pool.getMaterialsForRarity(MaterialRarity.COMMON)).toHaveLength(7);
			expect(pool.getMaterialsForRarity(MaterialRarity.UNCOMMON)).toHaveLength(7);
			expect(pool.getMaterialsForRarity(MaterialRarity.RARE)).toHaveLength(6);
			for (const rarity of RARITY_BUCKETS) {
				const ids = pool.getMaterialsForRarity(rarity);
				expect(new Set(ids).size).toBe(ids.length);
			}
		}
	});

	it("references only material ids in [1, 90]", () => {
		for (const cat of ITEM_MATERIAL_CATEGORY_IDS) {
			const pool = ItemMaterialCategoryDataController.instance.getPool(cat)!;
			for (const rarity of RARITY_BUCKETS) {
				for (const id of pool.getMaterialsForRarity(rarity)) {
					expect(id).toBeGreaterThanOrEqual(1);
					expect(id).toBeLessThanOrEqual(TOTAL_MATERIALS);
				}
			}
		}
	});

	it("places every material in 3 or 4 categories total", () => {
		const counts = new Map<number, number>();
		for (const cat of ITEM_MATERIAL_CATEGORY_IDS) {
			const pool = ItemMaterialCategoryDataController.instance.getPool(cat)!;
			for (const rarity of RARITY_BUCKETS) {
				for (const id of pool.getMaterialsForRarity(rarity)) {
					counts.set(id, (counts.get(id) ?? 0) + 1);
				}
			}
		}
		expect(counts.size).toBe(TOTAL_MATERIALS);
		for (const [id, count] of counts) {
			expect(count, `material ${id} appears in ${count} categories`).toBeGreaterThanOrEqual(3);
			expect(count, `material ${id} appears in ${count} categories`).toBeLessThanOrEqual(4);
		}
	});

	it("declares each material in the rarity bucket matching its own rarity", () => {
		for (const cat of ITEM_MATERIAL_CATEGORY_IDS) {
			const pool = ItemMaterialCategoryDataController.instance.getPool(cat)!;
			for (const declaredRarity of RARITY_BUCKETS) {
				for (const id of pool.getMaterialsForRarity(declaredRarity)) {
					const material = MaterialDataController.instance.getById(String(id));
					expect(material, `material ${id} missing in DataController`).toBeDefined();
					expect(material!.rarity, `material ${id} in category ${cat} declared as ${declaredRarity} but is ${material!.rarity}`).toBe(declaredRarity);
				}
			}
		}
	});
});
