import { describe, expect, it } from "vitest";
import { ItemCategory, ItemRarity } from "../../../../Lib/src/constants/ItemConstants";
import { Material } from "../../../src/data/Material";
import { MainItem } from "../../../src/data/MainItem";
import { getScrapDealerMaterials } from "../../../src/core/report/ReportScrapDealerService";

class TestMainItem extends MainItem {
	public categoryName = "weapons";

	public readonly rarity = ItemRarity.COMMON;

	public id = 42;

	public requestedLevels: number[] = [];

	private readonly materials: Material[];

	public constructor(materials: Material[]) {
		super();
		this.materials = materials;
	}

	protected getBaseAttack(): number {
		return 0;
	}

	protected getBaseDefense(): number {
		return 0;
	}

	public getAttack(_itemLevel: number): number {
		return 0;
	}

	public getDefense(_itemLevel: number): number {
		return 0;
	}

	public getCategory(): number {
		return ItemCategory.WEAPON;
	}

	public getItemAddedValue(): number {
		return 0;
	}

	public getUpgradeMaterials(level: number): Material[] {
		this.requestedLevels.push(level);
		return this.materials;
	}
}

function makeMaterial(id: string): Material {
	return { id } as Material;
}

describe("getScrapDealerMaterials", () => {
	it("uses the first upgrade materials for a base item and rounds recovery up per material", () => {
		const item = new TestMainItem([
			makeMaterial("10"),
			makeMaterial("10"),
			makeMaterial("10"),
			makeMaterial("11")
		]);

		expect(getScrapDealerMaterials(item, 0)).toEqual([
			{ materialId: 10, quantity: 2 },
			{ materialId: 11, quantity: 1 }
		]);
		expect(item.requestedLevels).toEqual([1]);
	});

	it("uses the current upgrade level for an upgraded item", () => {
		const item = new TestMainItem([makeMaterial("10")]);

		expect(getScrapDealerMaterials(item, 4)).toEqual([
			{ materialId: 10, quantity: 1 }
		]);
		expect(item.requestedLevels).toEqual([4]);
	});
});
