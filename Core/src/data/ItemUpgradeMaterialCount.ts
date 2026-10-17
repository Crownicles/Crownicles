import { DataControllerNumber } from "./DataController";
import { Data } from "./Data";
import { MaterialRarity } from "../../../Lib/src/types/MaterialRarity";
import { ItemRarity } from "../../../Lib/src/constants/ItemConstants";

interface DistinctCountPerMaterialRarity {
	readonly common: number;
	readonly uncommon: number;
	readonly rare: number;
}

/**
 * Number of *distinct* materials picked for an upgrade of an item of a given
 * item rarity, loaded from `resources/itemUpgradeMaterialCounts/<itemRarity>.json`.
 *
 * `levels` is indexed by `upgradeLevel - 1` (5 entries, one per upgrade level).
 * Together with `ItemConstants.UPGRADE_MATERIALS_PER_ITEM_RARITY_AND_LEVEL`
 * (total quantity per rarity), this drives the upgrade recipe. The invariants
 * (5 levels, caps per pool size, BASIC = 0, total in [2..10]) are validated by
 * `Core/__tests__/core/data/ItemUpgradeMaterialCounts.test.ts`.
 */
export class ItemUpgradeMaterialCount extends Data<number> {
	public readonly levels!: readonly DistinctCountPerMaterialRarity[];

	public getDistinctCount(upgradeLevel: number, materialRarity: MaterialRarity): number {
		const entry = this.levels[upgradeLevel - 1];
		if (!entry) {
			return 0;
		}
		switch (materialRarity) {
			case MaterialRarity.COMMON:
				return entry.common;
			case MaterialRarity.UNCOMMON:
				return entry.uncommon;
			case MaterialRarity.RARE:
				return entry.rare;
			default:
				return 0;
		}
	}
}

export class ItemUpgradeMaterialCountDataController extends DataControllerNumber<ItemUpgradeMaterialCount> {
	static readonly instance: ItemUpgradeMaterialCountDataController = new ItemUpgradeMaterialCountDataController("itemUpgradeMaterialCounts");

	newInstance(): ItemUpgradeMaterialCount {
		return new ItemUpgradeMaterialCount();
	}

	public getForItemRarity(itemRarity: ItemRarity): ItemUpgradeMaterialCount | undefined {
		return this.getById(itemRarity);
	}
}
