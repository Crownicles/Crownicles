import { HomeFeatures } from "./HomeFeatures";
import { ItemRarity } from "../constants/ItemConstants";
import { GardenEarthQuality } from "./GardenEarthQuality";

export class HomeLevel {
	public static readonly LEVEL_1 = new HomeLevel(1, 0, 1000, {
		bedHealthRegeneration: 1,
		chestSlots: 0,
		craftPotionMaximumRarity: ItemRarity.BASIC,
		upgradeItemMaximumRarity: ItemRarity.BASIC,
		maxItemUpgradeLevel: 1,
		gardenPlots: 0,
		gardenEarthQuality: GardenEarthQuality.POOR
	});

	public static readonly LEVEL_2 = new HomeLevel(2, 15, 5000, {
		bedHealthRegeneration: 2,
		chestSlots: 1,
		craftPotionMaximumRarity: ItemRarity.UNCOMMON,
		upgradeItemMaximumRarity: ItemRarity.UNCOMMON,
		maxItemUpgradeLevel: 1,
		gardenPlots: 0,
		gardenEarthQuality: GardenEarthQuality.POOR
	});

	public static readonly LEVEL_3 = new HomeLevel(3, 30, 20000, {
		bedHealthRegeneration: 3,
		chestSlots: 2,
		craftPotionMaximumRarity: ItemRarity.EXOTIC,
		upgradeItemMaximumRarity: ItemRarity.EXOTIC,
		maxItemUpgradeLevel: 1,
		gardenPlots: 1,
		gardenEarthQuality: GardenEarthQuality.POOR
	});

	public static readonly LEVEL_4 = new HomeLevel(4, 45, 50000, {
		bedHealthRegeneration: 4,
		chestSlots: 2,
		craftPotionMaximumRarity: ItemRarity.RARE,
		upgradeItemMaximumRarity: ItemRarity.RARE,
		maxItemUpgradeLevel: 1,
		gardenPlots: 2,
		gardenEarthQuality: GardenEarthQuality.POOR
	});

	public static readonly LEVEL_5 = new HomeLevel(5, 60, 75000, {
		bedHealthRegeneration: 5,
		chestSlots: 3,
		craftPotionMaximumRarity: ItemRarity.SPECIAL,
		upgradeItemMaximumRarity: ItemRarity.SPECIAL,
		maxItemUpgradeLevel: 2,
		gardenPlots: 3,
		gardenEarthQuality: GardenEarthQuality.AVERAGE
	});

	public static readonly LEVEL_6 = new HomeLevel(6, 85, 150000, {
		bedHealthRegeneration: 6,
		chestSlots: 4,
		craftPotionMaximumRarity: ItemRarity.EPIC,
		upgradeItemMaximumRarity: ItemRarity.EPIC,
		maxItemUpgradeLevel: 2,
		gardenPlots: 3,
		gardenEarthQuality: GardenEarthQuality.AVERAGE
	});

	public static readonly LEVEL_7 = new HomeLevel(7, 100, 250000, {
		bedHealthRegeneration: 7,
		chestSlots: 5,
		craftPotionMaximumRarity: ItemRarity.LEGENDARY,
		upgradeItemMaximumRarity: ItemRarity.LEGENDARY,
		maxItemUpgradeLevel: 2,
		gardenPlots: 4,
		gardenEarthQuality: GardenEarthQuality.RICH
	});

	public static readonly LEVEL_8 = new HomeLevel(8, 120, 450000, {
		bedHealthRegeneration: 8,
		chestSlots: 6,
		craftPotionMaximumRarity: ItemRarity.MYTHICAL,
		upgradeItemMaximumRarity: ItemRarity.MYTHICAL,
		maxItemUpgradeLevel: 2,
		gardenPlots: 5,
		gardenEarthQuality: GardenEarthQuality.RICH
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
