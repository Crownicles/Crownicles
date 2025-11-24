import { ItemRarity } from "../constants/ItemConstants";
import { GardenEarthQuality } from "./GardenEarthQuality";

export interface HomeFeatures {
	chestSlots: number;
	bedHealthRegeneration: number;
	craftPotionMaximumRarity: ItemRarity;
	upgradeItemMaximumRarity: ItemRarity;
	gardenPlots: number;
	gardenEarthQuality: GardenEarthQuality;
}
