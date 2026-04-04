import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
import { MaterialDataController } from "../../data/Material";
import { Materials } from "../database/game/models/Material";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";

export interface BossLootEntry {
	materialId: number;
	quantity: number;
}

/**
 * Generate boss material loot from a boss's loot table, weighted by material rarity
 */
export function generateBossLoot(mapId: number): BossLootEntry[] {
	const lootTable = PVEConstants.BOSS_LOOT_TABLES[mapId];
	if (!lootTable || lootTable.length === 0) {
		return [];
	}

	const totalDrops = RandomUtils.randInt(PVEConstants.BOSS_LOOT.MIN_DROPS, PVEConstants.BOSS_LOOT.MAX_DROPS + 1);

	// Build weighted entries from the loot table
	const weightedEntries: {
		materialId: number; weight: number;
	}[] = [];
	for (const materialId of lootTable) {
		const material = MaterialDataController.instance.getById(String(materialId));
		if (material) {
			const weight = PVEConstants.BOSS_LOOT.RARITY_WEIGHTS[material.rarity] ?? 0;
			weightedEntries.push({
				materialId,
				weight
			});
		}
	}

	if (weightedEntries.length === 0) {
		return [];
	}

	const totalWeight = weightedEntries.reduce((sum, entry) => sum + entry.weight, 0);

	// Roll each drop independently
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
 * Apply boss loot to a player's inventory
 */
export async function applyBossLoot(playerId: number, loot: BossLootEntry[]): Promise<void> {
	for (const entry of loot) {
		await Materials.giveMaterial(playerId, entry.materialId, entry.quantity);
	}
}
