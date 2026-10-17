import { ShopConstants } from "../../../../Lib/src/constants/ShopConstants";
import { MaterialRarity } from "../../../../Lib/src/types/MaterialRarity";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { MaterialDataController } from "../../data/Material";

/**
 * Pick a rarity from a uniform roll [0, 1] using the configured drop-rate ladder.
 * - roll < RARE_PROBABILITY                         -> RARE
 * - roll < RARE_PROBABILITY + UNCOMMON_PROBABILITY  -> UNCOMMON
 * - otherwise                                       -> COMMON
 */
export function pickRarityFromRoll(roll: number): MaterialRarity {
	const rare = ShopConstants.MATERIAL_MERCHANT_DROP_RATES.RARE_PROBABILITY;
	const uncommon = ShopConstants.MATERIAL_MERCHANT_DROP_RATES.UNCOMMON_PROBABILITY;
	if (roll < rare) {
		return MaterialRarity.RARE;
	}
	if (roll < rare + uncommon) {
		return MaterialRarity.UNCOMMON;
	}
	return MaterialRarity.COMMON;
}

/**
 * Build a material distribution by rolling `totalQuantity` times against the rarity ladder
 * then picking a random material for the resulting rarity.
 *
 * Pure logic: no DB writes, no side effects beyond RNG/data lookups. Suitable for unit testing.
 *
 * Materials whose pool is empty (no material of that rarity exists) are silently skipped,
 * so the returned distribution may contain less than `totalQuantity` items in total.
 */
export function pickMaterialDistribution(totalQuantity: number): Map<number, number> {
	const distribution = new Map<number, number>();
	for (let i = 0; i < totalQuantity; i++) {
		const roll = RandomUtils.crowniclesRandom.realZeroToOneInclusive();
		const rarity = pickRarityFromRoll(roll);
		const material = MaterialDataController.instance.getRandomMaterialFromRarity(rarity);
		if (material) {
			const materialId = parseInt(material.id, 10);
			distribution.set(materialId, (distribution.get(materialId) ?? 0) + 1);
		}
	}
	return distribution;
}
