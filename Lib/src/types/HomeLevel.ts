import { HomeFeatures } from "./HomeFeatures";
import { ItemRarity } from "../constants/ItemConstants";
import { GardenEarthQuality } from "./GardenEarthQuality";

export class HomeLevel {
	public static readonly LEVEL_1 = new HomeLevel(1, 0, 1000, {
		bedHealthRegeneration: 5,
		chestSlots: 0,
		craftPotionMaximumRarity: ItemRarity.BASIC,
		upgradeItemMaximumRarity: ItemRarity.BASIC,
		gardenPlots: 0,
		gardenEarthQuality: GardenEarthQuality.POOR
	});

	public static readonly LEVEL_2 = new HomeLevel(2, 15, 5000, {
		bedHealthRegeneration: 10,
		chestSlots: 1,
		craftPotionMaximumRarity: ItemRarity.UNCOMMON,
		upgradeItemMaximumRarity: ItemRarity.UNCOMMON,
		gardenPlots: 0,
		gardenEarthQuality: GardenEarthQuality.POOR
	});

	public static readonly LEVEL_3 = new HomeLevel(3, 30, 20000, {
		bedHealthRegeneration: 15,
		chestSlots: 2,
		craftPotionMaximumRarity: ItemRarity.EXOTIC,
		upgradeItemMaximumRarity: ItemRarity.EXOTIC,
		gardenPlots: 1,
		gardenEarthQuality: GardenEarthQuality.POOR
	});

	public static readonly LEVEL_4 = new HomeLevel(4, 45, 50000, {
		bedHealthRegeneration: 20,
		chestSlots: 2,
		craftPotionMaximumRarity: ItemRarity.RARE,
		upgradeItemMaximumRarity: ItemRarity.RARE,
		gardenPlots: 2,
		gardenEarthQuality: GardenEarthQuality.POOR
	});

	public static readonly LEVEL_5 = new HomeLevel(5, 60, 75000, {
		bedHealthRegeneration: 25,
		chestSlots: 3,
		craftPotionMaximumRarity: ItemRarity.SPECIAL,
		upgradeItemMaximumRarity: ItemRarity.SPECIAL,
		gardenPlots: 3,
		gardenEarthQuality: GardenEarthQuality.AVERAGE
	});

	public static readonly LEVEL_6 = new HomeLevel(6, 85, 150000, {
		bedHealthRegeneration: 30,
		chestSlots: 4,
		craftPotionMaximumRarity: ItemRarity.EPIC,
		upgradeItemMaximumRarity: ItemRarity.EPIC,
		gardenPlots: 3,
		gardenEarthQuality: GardenEarthQuality.AVERAGE
	});

	public static readonly LEVEL_7 = new HomeLevel(7, 100, 250000, {
		bedHealthRegeneration: 35,
		chestSlots: 5,
		craftPotionMaximumRarity: ItemRarity.LEGENDARY,
		upgradeItemMaximumRarity: ItemRarity.LEGENDARY,
		gardenPlots: 4,
		gardenEarthQuality: GardenEarthQuality.RICH
	});

	public static readonly LEVEL_8 = new HomeLevel(8, 120, 450000, {
		bedHealthRegeneration: 40,
		chestSlots: 6,
		craftPotionMaximumRarity: ItemRarity.MYTHICAL,
		upgradeItemMaximumRarity: ItemRarity.MYTHICAL,
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
		for (const homeLevel of HomeLevel.LEVELS) {
			if (homeLevel.level === level) {
				return homeLevel;
			}
		}

		return null;
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
