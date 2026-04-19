import {
	BlacksmithConstants, ItemUpgradeLevel
} from "../constants/BlacksmithConstants";
import { ItemRarity } from "../constants/ItemConstants";
import { MaterialRarity } from "../types/MaterialRarity";

/**
 * Calculate the upgrade price for a specific item rarity and target level
 * @param targetLevel The level the item will become after upgrade (1-4)
 * @param itemRarity The rarity of the item being upgraded
 * @returns The gold cost for the upgrade at the blacksmith
 */
export function getUpgradePrice(targetLevel: ItemUpgradeLevel, itemRarity: ItemRarity): number {
	const basePrice = BlacksmithConstants.BASE_UPGRADE_PRICES[targetLevel];
	const rarityDifference = itemRarity - BlacksmithConstants.REFERENCE_RARITY;
	const modifier = 1 + (rarityDifference * BlacksmithConstants.RARITY_PRICE_MODIFIER_PERCENT / 100);
	return Math.round(basePrice * modifier);
}

/**
 * Calculate the total price for buying missing materials
 * Price increases with each additional material bought
 * @param materials Array of missing materials with their rarity
 * @returns Total gold cost to buy all missing materials
 */
export function getMaterialsPurchasePrice(materials: {
	rarity: MaterialRarity; quantity: number;
}[]): number {
	let totalPrice = 0;
	let materialIndex = 0;

	for (const material of materials) {
		const basePrice = BlacksmithConstants.MATERIAL_BASE_PRICE[material.rarity];
		for (let i = 0; i < material.quantity; i++) {
			const multiplier = 1 + (materialIndex * BlacksmithConstants.MATERIAL_BULK_PRICE_INCREASE_PERCENT / 100);
			totalPrice += Math.round(basePrice * multiplier);
			materialIndex++;
		}
	}

	return totalPrice;
}

/**
 * Get the disenchant price for a specific item rarity
 * @param itemRarity The rarity of the item being disenchanted
 * @returns The gold cost to disenchant the item
 */
export function getDisenchantPrice(itemRarity: ItemRarity): number {
	return BlacksmithConstants.DISENCHANT_PRICE[itemRarity];
}
