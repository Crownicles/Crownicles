import {
	describe, expect, it
} from "vitest";
import {
	ItemCategory, ItemConstants, ItemRarity
} from "../../../../Lib/src/constants/ItemConstants";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { ScrapDealerConstants } from "../../../../Lib/src/constants/ScrapDealerConstants";
import { getMaterialsPurchasePrice } from "../../../../Lib/src/utils/BlacksmithUtils";
import { Material } from "../../../src/data/Material";
import { MainItem } from "../../../src/data/MainItem";
import { getScrapDealerMaterials } from "../../../src/core/report/ReportCityScrapDealerService";

class TestMainItem extends MainItem {
	public categoryName = "weapons";

	public readonly rarity: ItemRarity;

	public id = 42;

	public requestedLevels: number[] = [];

	private readonly materialsByLevel: Map<number, Material[]>;

	public constructor(rarity: ItemRarity, materialsByLevel: Map<number, Material[]>) {
		super();
		this.rarity = rarity;
		this.materialsByLevel = materialsByLevel;
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
		return this.materialsByLevel.get(level) ?? [];
	}
}

function makeMaterial(id: string, rarity: MaterialRarity = MaterialRarity.COMMON): Material {
	return {
		id, rarity
	} as Material;
}

describe("getScrapDealerMaterials", () => {
	it("gives nothing back for an item without any upgrade recipe", () => {
		const item = new TestMainItem(ItemRarity.COMMON, new Map());

		expect(getScrapDealerMaterials(item, 3)).toEqual([]);
	});

	it("stops as soon as the blacksmith price of the given materials reaches the scaled item value", () => {
		const item = new TestMainItem(ItemRarity.COMMON, new Map([[1, [
			makeMaterial("10"),
			makeMaterial("11"),
			makeMaterial("12"),
			makeMaterial("13")
		]]]));

		expect(getScrapDealerMaterials(item, 1)).toEqual([{
			materialId: 10, quantity: 1
		}]);
	});

	it("keeps the rarity mix of the item recipe instead of draining the common materials first", () => {
		const item = new TestMainItem(ItemRarity.EPIC, new Map([[1, [
			makeMaterial("10"),
			makeMaterial("10"),
			makeMaterial("10"),
			makeMaterial("20", MaterialRarity.UNCOMMON),
			makeMaterial("20", MaterialRarity.UNCOMMON),
			makeMaterial("30", MaterialRarity.RARE)
		]]]));

		expect(getScrapDealerMaterials(item, 0)).toEqual([
			{
				materialId: 10, quantity: 1
			},
			{
				materialId: 20, quantity: 1
			},
			{
				materialId: 30, quantity: 1
			}
		]);
	});

	it("hands out materials worth the item value scaled by its upgrade level", () => {
		const rarityByMaterialId = new Map([
			[10, MaterialRarity.COMMON],
			[20, MaterialRarity.UNCOMMON]
		]);
		const givenPrice = (itemLevel: number): number => {
			const item = new TestMainItem(ItemRarity.EPIC, new Map([
				[1, [makeMaterial("10"), makeMaterial("20", MaterialRarity.UNCOMMON)]],
				[2, [makeMaterial("10"), makeMaterial("20", MaterialRarity.UNCOMMON)]]
			]));
			return getMaterialsPurchasePrice(getScrapDealerMaterials(item, itemLevel).map(material => ({
				rarity: rarityByMaterialId.get(material.materialId)!,
				quantity: material.quantity
			})));
		};
		const epicValue = ItemConstants.RARITY.VALUES[ItemRarity.EPIC];

		expect(givenPrice(0)).toBeGreaterThanOrEqual(epicValue * ScrapDealerConstants.BASE_VALUE_MULTIPLIER);
		expect(givenPrice(2)).toBeGreaterThanOrEqual(epicValue * (ScrapDealerConstants.BASE_VALUE_MULTIPLIER + 2));
		expect(givenPrice(2)).toBeGreaterThan(givenPrice(0));
	});
});
