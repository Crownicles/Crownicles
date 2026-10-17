import { DataControllerString } from "./DataController";
import { Data } from "./Data";
import { MaterialType } from "../../../Lib/src/types/MaterialType";
import { MaterialRarity } from "../../../Lib/src/types/MaterialRarity";
import { RandomUtils } from "../../../Lib/src/utils/RandomUtils";

export class Material extends Data<string> {
	public readonly type!: MaterialType;

	public readonly rarity!: MaterialRarity;
}

export class MaterialDataController extends DataControllerString<Material> {
	static readonly instance: MaterialDataController = new MaterialDataController("materials");

	static readonly materialsTypeCache: Map<string, Material[]> = new Map<string, Material[]>();

	newInstance(): Material {
		return new Material();
	}

	public getMaterialsFromType(type: MaterialType): Material[] {
		let materials = MaterialDataController.materialsTypeCache.get(type);

		if (!materials) {
			materials = this.getValuesArray().filter(material => material.type === type);
			MaterialDataController.materialsTypeCache.set(type, materials);
		}

		return materials;
	}

	public getRandomMaterialFromRarity(rarity: MaterialRarity): Material | null {
		const materials = this.getValuesArray().filter(material => material.rarity === rarity);
		if (materials.length === 0) {
			return null;
		}
		return RandomUtils.crowniclesRandom.pick(materials);
	}
}
