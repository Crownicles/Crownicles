import {
	ChestSlotsPerCategory, HomeFeatures
} from "../types/HomeFeatures";
import { ItemRarity } from "../constants/ItemConstants";

export const HOME_UPGRADE_CHANGES = {
	CHEST: "chest",
	BIGGER_CHEST: "biggerChest",
	INVENTORY_BONUS: "inventoryBonus",
	UPGRADE_ITEM_STATION: "upgradeItemStation",
	BETTER_UPGRADE_ITEM_STATION: "betterUpgradeItemStation",
	BETTER_BED: "betterBed",
	GARDEN: "garden",
	BIGGER_GARDEN: "biggerGarden",
	BETTER_GARDEN_EARTH: "betterGardenEarth",
	COOKING_STATION: "cookingStation",
	BETTER_COOKING_STATION: "betterCookingStation"
} as const;

export type HomeUpgradeChange = typeof HOME_UPGRADE_CHANGES[keyof typeof HOME_UPGRADE_CHANGES];

function hasSlotsChanged(oldSlots: ChestSlotsPerCategory, newSlots: ChestSlotsPerCategory): boolean {
	return oldSlots.weapon !== newSlots.weapon
		|| oldSlots.armor !== newSlots.armor
		|| oldSlots.object !== newSlots.object
		|| oldSlots.potion !== newSlots.potion;
}

function totalSlots(slots: ChestSlotsPerCategory): number {
	return slots.weapon + slots.armor + slots.object + slots.potion;
}

interface UpgradeCheck {
	hasChanged: (oldF: HomeFeatures, newF: HomeFeatures) => boolean;
	isNew: (oldF: HomeFeatures) => boolean;
	newKey: HomeUpgradeChange;
	upgradeKey: HomeUpgradeChange;
}

const UPGRADE_CHECKS: UpgradeCheck[] = [
	{
		hasChanged: (o, n): boolean => hasSlotsChanged(o.chestSlots, n.chestSlots),
		isNew: (o): boolean => totalSlots(o.chestSlots) === 0,
		newKey: HOME_UPGRADE_CHANGES.CHEST,
		upgradeKey: HOME_UPGRADE_CHANGES.BIGGER_CHEST
	},
	{
		hasChanged: (o, n): boolean => hasSlotsChanged(o.inventoryBonus, n.inventoryBonus),
		isNew: (): boolean => false,
		newKey: HOME_UPGRADE_CHANGES.INVENTORY_BONUS,
		upgradeKey: HOME_UPGRADE_CHANGES.INVENTORY_BONUS
	},
	{
		hasChanged: (o, n): boolean => o.upgradeItemMaximumRarity !== n.upgradeItemMaximumRarity,
		isNew: (o): boolean => o.upgradeItemMaximumRarity === ItemRarity.BASIC,
		newKey: HOME_UPGRADE_CHANGES.UPGRADE_ITEM_STATION,
		upgradeKey: HOME_UPGRADE_CHANGES.BETTER_UPGRADE_ITEM_STATION
	},
	{
		hasChanged: (o, n): boolean => o.bedHealthRegeneration !== n.bedHealthRegeneration,
		isNew: (): boolean => false,
		newKey: HOME_UPGRADE_CHANGES.BETTER_BED,
		upgradeKey: HOME_UPGRADE_CHANGES.BETTER_BED
	},
	{
		hasChanged: (o, n): boolean => o.gardenPlots !== n.gardenPlots,
		isNew: (o): boolean => o.gardenPlots === 0,
		newKey: HOME_UPGRADE_CHANGES.GARDEN,
		upgradeKey: HOME_UPGRADE_CHANGES.BIGGER_GARDEN
	},
	{
		hasChanged: (o, n): boolean => o.gardenEarthQuality !== n.gardenEarthQuality,
		isNew: (): boolean => false,
		newKey: HOME_UPGRADE_CHANGES.BETTER_GARDEN_EARTH,
		upgradeKey: HOME_UPGRADE_CHANGES.BETTER_GARDEN_EARTH
	},
	{
		hasChanged: (o, n): boolean => o.cookingSlots !== n.cookingSlots,
		isNew: (o): boolean => o.cookingSlots === 0,
		newKey: HOME_UPGRADE_CHANGES.COOKING_STATION,
		upgradeKey: HOME_UPGRADE_CHANGES.BETTER_COOKING_STATION
	}
];

/**
 * What a home upgrade brings, as keys of `commands:report.city.homes.upgradeChanges`
 * @param oldFeatures
 * @param newFeatures
 */
export function homeUpgradeChanges(oldFeatures: HomeFeatures, newFeatures: HomeFeatures): HomeUpgradeChange[] {
	return UPGRADE_CHECKS
		.filter(check => check.hasChanged(oldFeatures, newFeatures))
		.map(check => check.isNew(oldFeatures) ? check.newKey : check.upgradeKey);
}
