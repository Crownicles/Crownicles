import { MaterialRarity } from "../types/MaterialRarity";

/**
 * Shared constants for material loot generation across PVE bosses and pet expeditions.
 */
export abstract class MaterialLootConstants {
	/**
	 * Relative weights used to bias weighted random material selection by rarity.
	 * Common materials drop 6× more often than rare ones.
	 */
	static readonly RARITY_WEIGHTS: Record<MaterialRarity, number> = {
		[MaterialRarity.COMMON]: 60,
		[MaterialRarity.UNCOMMON]: 30,
		[MaterialRarity.RARE]: 10
	};

	/**
	 * Bounds enforced on every loot table entry (boss or expedition) by the
	 * MaterialTest integrity test.
	 */
	static readonly LOOT_TABLE_MIN_SIZE = 3;

	static readonly LOOT_TABLE_MAX_SIZE = 10;
}
