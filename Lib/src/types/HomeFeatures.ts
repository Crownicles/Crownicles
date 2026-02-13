import { ItemRarity } from "../constants/ItemConstants";
import { GardenEarthQuality } from "./GardenEarthQuality";

export interface ChestSlotsPerCategory {
	weapon: number;
	armor: number;
	object: number;
	potion: number;
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
