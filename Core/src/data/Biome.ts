import { DataControllerString } from "./DataController";
import { Data } from "./Data";
import { Biome } from "../../../Lib/src/types/Biome";

/**
 * Biome definition, loaded from `resources/biomes/<biome>.json`.
 * Its material loot is the single source of the materials found in this biome,
 * shared by the expeditions and the find material small event.
 */
export class BiomeData extends Data<string> {
	public readonly materialLoot!: readonly number[];
}

export class BiomeDataController extends DataControllerString<BiomeData> {
	static readonly instance: BiomeDataController = new BiomeDataController("biomes");

	newInstance(): BiomeData {
		return new BiomeData();
	}

	/**
	 * Get the material IDs that can be looted in the given biome
	 * @param biome
	 */
	public getMaterialLoot(biome: Biome): readonly number[] {
		return this.getById(biome)?.materialLoot ?? [];
	}
}
