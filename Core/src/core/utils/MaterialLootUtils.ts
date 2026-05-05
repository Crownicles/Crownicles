import { MaterialDataController } from "../../data/Material";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { MaterialQuantity } from "../../../../Lib/src/types/MaterialQuantity";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { Materials } from "../database/game/models/Material";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
import { MaterialLootConstants } from "../../../../Lib/src/constants/MaterialLootConstants";

/**
 * Generate weighted material loot from a pool of material IDs, where each
 * material's weight is determined by its rarity.
 *
 * Each drop is rolled independently against the cumulative weight distribution.
 *
 * @param materialIdPool - Material IDs eligible for this loot table
 * @param totalDrops - Number of independent draws to perform
 * @param rarityWeights - Mapping from rarity to its relative weight
 * @returns Aggregated drops with quantities
 */
export function generateWeightedMaterialLoot(
	materialIdPool: readonly number[],
	totalDrops: number,
	rarityWeights: Record<MaterialRarity, number>
): MaterialQuantity[] {
	if (materialIdPool.length === 0 || totalDrops <= 0) {
		return [];
	}

	const weightedEntries: {
		materialId: number; weight: number;
	}[] = [];
	for (const materialId of materialIdPool) {
		const material = MaterialDataController.instance.getById(String(materialId));
		if (material) {
			const weight = rarityWeights[material.rarity as MaterialRarity] ?? 0;
			if (weight > 0) {
				weightedEntries.push({
					materialId,
					weight
				});
			}
		}
	}

	if (weightedEntries.length === 0) {
		return [];
	}

	const totalWeight = weightedEntries.reduce((sum, entry) => sum + entry.weight, 0);

	const lootMap = new Map<number, number>();
	for (let i = 0; i < totalDrops; i++) {
		let roll = RandomUtils.randInt(0, totalWeight);
		for (const entry of weightedEntries) {
			roll -= entry.weight;
			if (roll < 0) {
				lootMap.set(entry.materialId, (lootMap.get(entry.materialId) ?? 0) + 1);
				break;
			}
		}
	}

	return Array.from(lootMap.entries()).map(([materialId, quantity]) => ({
		materialId,
		quantity
	}));
}

/**
 * Give every material entry in the loot to the player's inventory.
 */
export async function applyMaterialLoot(playerId: number, loot: MaterialQuantity[]): Promise<void> {
	for (const entry of loot) {
		await Materials.giveMaterial(playerId, entry.materialId, entry.quantity);
	}
}

/**
 * Generate boss material loot from a boss's loot table, weighted by material rarity.
 */
export function generateBossLoot(mapId: number): MaterialQuantity[] {
	const lootTable = PVEConstants.BOSS_LOOT_TABLES[mapId];
	if (!lootTable || lootTable.length === 0) {
		return [];
	}

	const totalDrops = RandomUtils.randInt(PVEConstants.BOSS_LOOT.MIN_DROPS, PVEConstants.BOSS_LOOT.MAX_DROPS + 1);
	return generateWeightedMaterialLoot(lootTable, totalDrops, MaterialLootConstants.RARITY_WEIGHTS);
}
