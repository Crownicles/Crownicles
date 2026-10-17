import { DataControllerNumber } from "./DataController";
import { Data } from "./Data";
import { MaterialRarity } from "../../../Lib/src/types/MaterialRarity";
import { ItemMaterialCategory } from "../../../Lib/src/constants/ItemMaterialCategoryConstants";

/**
 * Pool of materials used to upgrade an item belonging to a given material
 * category, loaded from `resources/itemMaterialCategories/<categoryId>.json`.
 *
 * Each pool holds exactly 7 COMMON + 7 UNCOMMON + 6 RARE material ids. These
 * invariants (and the cross-category distribution) are validated by
 * `Core/__tests__/core/data/ItemMaterialCategoryPools.test.ts`.
 */
export class ItemMaterialCategoryPool extends Data<number> {
	public readonly common!: readonly number[];

	public readonly uncommon!: readonly number[];

	public readonly rare!: readonly number[];

	public getMaterialsForRarity(rarity: MaterialRarity): readonly number[] {
		switch (rarity) {
			case MaterialRarity.COMMON:
				return this.common;
			case MaterialRarity.UNCOMMON:
				return this.uncommon;
			case MaterialRarity.RARE:
				return this.rare;
			default:
				return [];
		}
	}
}

export class ItemMaterialCategoryDataController extends DataControllerNumber<ItemMaterialCategoryPool> {
	static readonly instance: ItemMaterialCategoryDataController = new ItemMaterialCategoryDataController("itemMaterialCategories");

	newInstance(): ItemMaterialCategoryPool {
		return new ItemMaterialCategoryPool();
	}

	public getPool(category: ItemMaterialCategory): ItemMaterialCategoryPool | undefined {
		return this.getById(category);
	}
}
