import { describe, expect, it } from "vitest";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { ItemUpgradeMaterialCountDataController } from "../../../src/data/ItemUpgradeMaterialCount";

const ITEM_RARITIES = Object.values(ItemRarity).filter(v => typeof v === "number") as ItemRarity[];

const COMMON_POOL_SIZE = 7;
const UNCOMMON_POOL_SIZE = 7;
const RARE_POOL_SIZE = 6;
const UPGRADE_LEVELS = 5;
const MAX_DISTINCT_PER_UPGRADE = 10;
const MIN_DISTINCT_PER_UPGRADE = 2;

describe("ItemUpgradeMaterialCount data (json invariants)", () => {
	it("exposes one entry per item rarity with 5 upgrade levels", () => {
		for (const itemRarity of ITEM_RARITIES) {
			const counts = ItemUpgradeMaterialCountDataController.instance.getForItemRarity(itemRarity);
			expect(counts).toBeDefined();
			expect(counts!.levels).toHaveLength(UPGRADE_LEVELS);
		}
	});

	it("never exceeds the pool size of its rarity bucket", () => {
		for (const itemRarity of ITEM_RARITIES) {
			const counts = ItemUpgradeMaterialCountDataController.instance.getForItemRarity(itemRarity)!;
			for (let level = 1; level <= UPGRADE_LEVELS; level++) {
				expect(counts.getDistinctCount(level, MaterialRarity.COMMON)).toBeLessThanOrEqual(COMMON_POOL_SIZE);
				expect(counts.getDistinctCount(level, MaterialRarity.UNCOMMON)).toBeLessThanOrEqual(UNCOMMON_POOL_SIZE);
				expect(counts.getDistinctCount(level, MaterialRarity.RARE)).toBeLessThanOrEqual(RARE_POOL_SIZE);
			}
		}
	});

	it("totals 0 for BASIC and stays within the distinct cap otherwise", () => {
		for (const itemRarity of ITEM_RARITIES) {
			const counts = ItemUpgradeMaterialCountDataController.instance.getForItemRarity(itemRarity)!;
			for (let level = 1; level <= UPGRADE_LEVELS; level++) {
				const total = counts.getDistinctCount(level, MaterialRarity.COMMON)
					+ counts.getDistinctCount(level, MaterialRarity.UNCOMMON)
					+ counts.getDistinctCount(level, MaterialRarity.RARE);
				if (itemRarity === ItemRarity.BASIC) {
					expect(total).toBe(0);
				}
				else {
					expect(total).toBeGreaterThanOrEqual(MIN_DISTINCT_PER_UPGRADE);
					expect(total).toBeLessThanOrEqual(MAX_DISTINCT_PER_UPGRADE);
				}
			}
		}
	});
});
