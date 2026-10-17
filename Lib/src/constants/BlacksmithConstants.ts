import { ItemRarity } from "./ItemConstants";
import { MaterialRarity } from "../types/MaterialRarity";

/**
 * Valid upgrade levels for items (1-5).
 * Level 1 = first upgrade from level 0, etc.
 * Levels 1-4 are reachable at the standard blacksmith; level 5
 * is reserved for the Royal Blacksmith at the royal castle.
 */
export type ItemUpgradeLevel = 1 | 2 | 3 | 4 | 5;

/**
 * All valid item levels: 0 (base) + upgrade levels (1-5)
 */
export type ItemLevel = 0 | ItemUpgradeLevel;

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
	static readonly BASE_UPGRADE_PRICES: Record<ItemUpgradeLevel, number> = {
		1: 50,
		2: 500,
		3: 1500,
		4: 3500,
		5: 7500
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
}

/**
 * Constants for the Royal Blacksmith, a special NPC found at the royal castle.
 *
 * Unlike the standard blacksmith:
 * - Only accepts players of level >= MIN_PLAYER_LEVEL
 * - Only upgrades items to TARGET_LEVEL (level 5); refuses anything else
 * - Costs gold (BASE_UPGRADE_PRICES[5]) + materials + extra gems based on item rarity
 * - Awards a special badge if a low-rarity item is upgraded to the max
 */
export abstract class RoyalBlacksmithConstants {
	/** Only the level-5 upgrade is performed by the Royal Blacksmith */
	static readonly TARGET_LEVEL: ItemUpgradeLevel = 5;

	/** Minimum player level required to be served by the Royal Blacksmith */
	static readonly MIN_PLAYER_LEVEL = 100;

	/**
	 * Extra gem cost (on top of gold + materials) per item rarity.
	 * Indexed by ItemRarity. BASIC is included for completeness but
	 * BASIC items are not upgradable in practice.
	 */
	static readonly GEM_COST_PER_RARITY: Record<ItemRarity, number> = {
		[ItemRarity.BASIC]: 0,
		[ItemRarity.COMMON]: 1,
		[ItemRarity.UNCOMMON]: 2,
		[ItemRarity.EXOTIC]: 3,
		[ItemRarity.RARE]: 4,
		[ItemRarity.SPECIAL]: 5,
		[ItemRarity.EPIC]: 6,
		[ItemRarity.LEGENDARY]: 7,
		[ItemRarity.MYTHICAL]: 8
	};

	/**
	 * Rarities strictly below this threshold trigger the "mocking badge"
	 * easter egg when upgraded to level 5.
	 */
	static readonly MOCK_BADGE_RARITY_THRESHOLD: ItemRarity = ItemRarity.RARE;
}
