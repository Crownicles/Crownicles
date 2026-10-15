/** What a home upgrade brings; mirrors Core's `HOME_UPGRADE_CHANGES`, checked by RestWs' tests. */
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
