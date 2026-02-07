import { ItemRarity } from "../constants/ItemConstants";
import { GardenEarthQuality } from "./GardenEarthQuality";

export interface HomeFeatures {
	chestSlots: number;
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
}
