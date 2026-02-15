import {
	ItemCategory, ItemRarity
} from "../constants/ItemConstants";
import { GardenEarthQuality } from "./GardenEarthQuality";

export interface ChestSlotsPerCategory {
	weapon: number;
	armor: number;
	object: number;
	potion: number;
}

export const EMPTY_SLOTS_PER_CATEGORY: ChestSlotsPerCategory = {
	weapon: 0, armor: 0, object: 0, potion: 0
};

/**
 * Get the value from ChestSlotsPerCategory for a given ItemCategory
 */
export function getSlotCountForCategory(slots: ChestSlotsPerCategory, category: ItemCategory): number {
	switch (category) {
		case ItemCategory.WEAPON:
			return slots.weapon;
		case ItemCategory.ARMOR:
			return slots.armor;
		case ItemCategory.POTION:
			return slots.potion;
		case ItemCategory.OBJECT:
			return slots.object;
		default:
			return 0;
	}
}

export interface HomeFeatures {
	chestSlots: ChestSlotsPerCategory;
	bedHealthRegeneration: number;
	craftPotionMaximumRarity: ItemRarity;
	upgradeItemMaximumRarity: ItemRarity;

	/**
	 * Maximum item level that can be achieved through upgrading at this home.
	 * Level 1 means only +0 → +1 upgrades, Level 2 means +0 → +2 upgrades.
	 */
	maxItemUpgradeLevel: number;
	gardenPlots: number;
	gardenEarthQuality: GardenEarthQuality;

	/**
	 * Permanent bonus to personal inventory slot counts.
	 * These slots are in addition to the base purchased slots and apply everywhere.
	 */
	inventoryBonus: ChestSlotsPerCategory;
}
