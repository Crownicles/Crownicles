import {
	EMPTY_SLOTS_PER_CATEGORY, HomeFeatures
} from "./HomeFeatures";
import { ItemRarity } from "../constants/ItemConstants";
import { GardenEarthQuality } from "./GardenEarthQuality";

export class HomeLevel {
	public static readonly LEVEL_1 = new HomeLevel(1, 0, 1000, {
		bedHealthRegeneration: 1,
		chestSlots: {
			weapon: 1, armor: 1, object: 0, potion: 0
		},
		craftPotionMaximumRarity: ItemRarity.BASIC,
		upgradeItemMaximumRarity: ItemRarity.BASIC,
		maxItemUpgradeLevel: 1,
		gardenPlots: 0,
		gardenEarthQuality: GardenEarthQuality.POOR,
		inventoryBonus: EMPTY_SLOTS_PER_CATEGORY
	});

	public static readonly LEVEL_2 = new HomeLevel(2, 15, 5000, {
		bedHealthRegeneration: 2,
		chestSlots: {
			weapon: 1, armor: 1, object: 1, potion: 1
		},
		craftPotionMaximumRarity: ItemRarity.UNCOMMON,
		upgradeItemMaximumRarity: ItemRarity.UNCOMMON,
		maxItemUpgradeLevel: 1,
		gardenPlots: 0,
		gardenEarthQuality: GardenEarthQuality.POOR,
		inventoryBonus: EMPTY_SLOTS_PER_CATEGORY
	});

	public static readonly LEVEL_3 = new HomeLevel(3, 30, 20000, {
		bedHealthRegeneration: 3,
		chestSlots: {
			weapon: 1, armor: 1, object: 1, potion: 1
		},
		craftPotionMaximumRarity: ItemRarity.EXOTIC,
		upgradeItemMaximumRarity: ItemRarity.EXOTIC,
		maxItemUpgradeLevel: 1,
		gardenPlots: 3,
		gardenEarthQuality: GardenEarthQuality.POOR,
		inventoryBonus: {
			weapon: 1, armor: 1, object: 0, potion: 0
		}
	});

	public static readonly LEVEL_4 = new HomeLevel(4, 45, 50000, {
		bedHealthRegeneration: 4,
		chestSlots: {
			weapon: 1, armor: 1, object: 1, potion: 1
		},
		craftPotionMaximumRarity: ItemRarity.RARE,
		upgradeItemMaximumRarity: ItemRarity.RARE,
		maxItemUpgradeLevel: 1,
		gardenPlots: 4,
		gardenEarthQuality: GardenEarthQuality.POOR,
		inventoryBonus: {
			weapon: 1, armor: 1, object: 1, potion: 1
		}
	});

	public static readonly LEVEL_5 = new HomeLevel(5, 60, 75000, {
		bedHealthRegeneration: 5,
		chestSlots: {
			weapon: 2, armor: 2, object: 1, potion: 1
		},
		craftPotionMaximumRarity: ItemRarity.SPECIAL,
		upgradeItemMaximumRarity: ItemRarity.SPECIAL,
		maxItemUpgradeLevel: 2,
		gardenPlots: 6,
		gardenEarthQuality: GardenEarthQuality.AVERAGE,
		inventoryBonus: {
			weapon: 1, armor: 1, object: 1, potion: 1
		}
	});

	public static readonly LEVEL_6 = new HomeLevel(6, 85, 150000, {
		bedHealthRegeneration: 6,
		chestSlots: {
			weapon: 2, armor: 2, object: 1, potion: 2
		},
		craftPotionMaximumRarity: ItemRarity.EPIC,
		upgradeItemMaximumRarity: ItemRarity.EPIC,
		maxItemUpgradeLevel: 2,
		gardenPlots: 8,
		gardenEarthQuality: GardenEarthQuality.AVERAGE,
		inventoryBonus: {
			weapon: 1, armor: 1, object: 1, potion: 1
		}
	});

	public static readonly LEVEL_7 = new HomeLevel(7, 100, 250000, {
		bedHealthRegeneration: 7,
		chestSlots: {
			weapon: 3, armor: 3, object: 1, potion: 3
		},
		craftPotionMaximumRarity: ItemRarity.LEGENDARY,
		upgradeItemMaximumRarity: ItemRarity.LEGENDARY,
		maxItemUpgradeLevel: 2,
		gardenPlots: 10,
		gardenEarthQuality: GardenEarthQuality.RICH,
		inventoryBonus: {
			weapon: 1, armor: 1, object: 1, potion: 1
		}
	});

	public static readonly LEVEL_8 = new HomeLevel(8, 120, 450000, {
		bedHealthRegeneration: 8,
		chestSlots: {
			weapon: 3, armor: 3, object: 2, potion: 4
		},
		craftPotionMaximumRarity: ItemRarity.MYTHICAL,
		upgradeItemMaximumRarity: ItemRarity.MYTHICAL,
		maxItemUpgradeLevel: 2,
		gardenPlots: 10,
		gardenEarthQuality: GardenEarthQuality.RICH,
		inventoryBonus: {
			weapon: 1, armor: 1, object: 1, potion: 1
		}
	});

	private static readonly LEVELS: HomeLevel[] = [
		HomeLevel.LEVEL_1,
		HomeLevel.LEVEL_2,
		HomeLevel.LEVEL_3,
		HomeLevel.LEVEL_4,
		HomeLevel.LEVEL_5,
		HomeLevel.LEVEL_6,
		HomeLevel.LEVEL_7,
		HomeLevel.LEVEL_8
	];


	public static getNextUpgrade(currentLevel: HomeLevel, playerLevel: number): HomeLevel | null {
		const nextLevelIndex = HomeLevel.LEVELS.indexOf(currentLevel) + 1;

		if (nextLevelIndex >= HomeLevel.LEVELS.length) {
			return null;
		}

		const nextLevel = HomeLevel.LEVELS[nextLevelIndex];

		if (playerLevel < nextLevel.requiredPlayerLevel) {
			return null;
		}

		return nextLevel;
	}

	public static getByLevel(level: number): HomeLevel | null {
		if (level < 1 || level > HomeLevel.LEVELS.length) {
			return null;
		}
		return HomeLevel.LEVELS[level - 1] || null;
	}

	public static getInitialLevel(): HomeLevel {
		return HomeLevel.LEVEL_1;
	}


	public level: number;

	public requiredPlayerLevel: number;

	public cost: number;

	public features: HomeFeatures;

	constructor(level: number, requiredPlayerLevel: number, cost: number, features: HomeFeatures) {
		this.level = level;
		this.requiredPlayerLevel = requiredPlayerLevel;
		this.cost = cost;
		this.features = features;
	}
}
