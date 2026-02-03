import { ItemRarity } from "./ItemConstants";
import { MaterialRarity } from "../types/MaterialRarity";

/**
 * Constants for the blacksmith NPC found in cities
 * The blacksmith can:
 * - Upgrade items from level 0 to MAX_UPGRADE_LEVEL
 * - Disenchant items to remove enchantments
 * - Sell missing materials for upgrades
 */
export abstract class BlacksmithConstants {
	/**
	 * Maximum upgrade level the blacksmith can achieve
	 * (0 -> 1, 1 -> 2, 2 -> 3, 3 -> 4)
	 */
	static readonly MAX_UPGRADE_LEVEL = 4;

	/**
	 * Base upgrade prices for EPIC rarity items
	 * Other rarities are adjusted using RARITY_PRICE_MODIFIER
	 * Index = target level (1 = upgrade from 0 to 1, etc.)
	 */
	static readonly BASE_UPGRADE_PRICES: Record<1 | 2 | 3 | 4, number> = {
		1: 50,
		2: 500,
		3: 1500,
		4: 3500
	};

	/**
	 * Price modifier per rarity level compared to EPIC
	 * EPIC is the reference rarity (1.0 multiplier)
	 * Each level above EPIC increases by this percentage
	 * Each level below EPIC decreases by this percentage
	 */
	static readonly RARITY_PRICE_MODIFIER_PERCENT = 9;

	/**
	 * Reference rarity for base prices (EPIC = 6)
	 */
	static readonly REFERENCE_RARITY = ItemRarity.EPIC;

	/**
	 * Base price per material when buying missing materials from the blacksmith
	 * Indexed by material rarity
	 */
	static readonly MATERIAL_BASE_PRICE: Record<MaterialRarity, number> = {
		[MaterialRarity.COMMON]: 340,
		[MaterialRarity.UNCOMMON]: 1850,
		[MaterialRarity.RARE]: 3650
	};

	/**
	 * Price multiplier increase per missing material bought
	 * For example, if 0.1, the 1st material costs 100%, 2nd costs 110%, 3rd costs 120%, etc.
	 */
	static readonly MATERIAL_BULK_PRICE_INCREASE_PERCENT = 10;

	/**
	 * Price to disenchant an item at the blacksmith
	 * May vary by item rarity (indexed by ItemRarity)
	 */
	static readonly DISENCHANT_PRICE: Record<ItemRarity, number> = {
		[ItemRarity.BASIC]: 0,
		[ItemRarity.COMMON]: 50,
		[ItemRarity.UNCOMMON]: 100,
		[ItemRarity.EXOTIC]: 200,
		[ItemRarity.RARE]: 400,
		[ItemRarity.SPECIAL]: 800,
		[ItemRarity.EPIC]: 1500,
		[ItemRarity.LEGENDARY]: 3000,
		[ItemRarity.MYTHICAL]: 6000
	};

	/**
	 * Calculate the upgrade price for a specific item rarity and target level
	 * @param targetLevel The level the item will become after upgrade (1-4)
	 * @param itemRarity The rarity of the item being upgraded
	 * @returns The gold cost for the upgrade at the blacksmith
	 */
	static getUpgradePrice(targetLevel: 1 | 2 | 3 | 4, itemRarity: ItemRarity): number {
		const basePrice = this.BASE_UPGRADE_PRICES[targetLevel];
		const rarityDifference = itemRarity - this.REFERENCE_RARITY;
		const modifier = 1 + (rarityDifference * this.RARITY_PRICE_MODIFIER_PERCENT / 100);
		return Math.round(basePrice * modifier);
	}

	/**
	 * Calculate the total price for buying missing materials
	 * Price increases with each additional material bought
	 * @param materials Array of missing materials with their rarity
	 * @returns Total gold cost to buy all missing materials
	 */
	static getMaterialsPurchasePrice(materials: {
		rarity: MaterialRarity; quantity: number;
	}[]): number {
		let totalPrice = 0;
		let materialIndex = 0;

		for (const material of materials) {
			const basePrice = this.MATERIAL_BASE_PRICE[material.rarity];
			for (let i = 0; i < material.quantity; i++) {
				const multiplier = 1 + (materialIndex * this.MATERIAL_BULK_PRICE_INCREASE_PERCENT / 100);
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
	static getDisenchantPrice(itemRarity: ItemRarity): number {
		return this.DISENCHANT_PRICE[itemRarity];
	}
}
