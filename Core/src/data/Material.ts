import { DataControllerString } from "./DataController";
import { Data } from "./Data";

export class Material extends Data<string> {
	public readonly type: string;

	public readonly rarity: number;
}

export class MaterialDataController extends DataControllerString<Material> {
	static readonly instance: MaterialDataController = new MaterialDataController("materials");

	newInstance(): Material {
		return new Material();
	}
}
