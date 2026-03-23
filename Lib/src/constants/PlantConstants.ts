import { TimeConstants } from "./TimeConstants";
import { getDayNumber } from "../utils/TimeUtils";
import { frac } from "../utils/MathUtils";

/**
 * Plant type IDs for the garden system.
 * Each plant has a unique ID (1-10), a growth time, and a fallback emoji.
 */
export enum PlantId {
	COMMON_HERB = 1,
	GOLDEN_CLOVER = 2,
	LUNAR_MOSS = 3,
	IRON_ROOT = 4,
	NIGHT_MUSHROOM = 5,
	VENOMOUS_LEAF = 6,
	FIRE_BULB = 7,
	MEAT_PLANT = 8,
	CRYSTAL_FLOWER = 9,
	ANCIENT_TREE = 10
}

/**
 * Condition keys for successful seed obtention
 */
export const SEED_CONDITION_SUCCESS = {
	FREE: "free",
	PAID: "paid",
	PAID_ACCEPTED: "paidAccepted",
	MOON: "moon",
	NIGHT: "night",
	HERBIVORE_PET: "herbivorePet",
	LEGENDARY_HERBIVORE_PET: "legendaryHerbivorePet",
	MAGE: "mage",
	PHOENIX: "phoenix",
	FIRE_ITEM: "fireItem",
	CARNIVORE_PET: "carnivorePet"
} as const;

/**
 * Condition keys for failed seed obtention (advice)
 */
export const SEED_CONDITION_FAILURE = {
	NEED_LEVEL: "needLevel",
	NEED_GARDEN: "needGarden",
	NEED_MONEY: "needMoney",
	NEED_MOONLIGHT: "needMoonlight",
	NEED_NIGHT: "needNight",
	NEED_HERBIVORE_PET: "needHerbivorePet",
	NEED_LEGENDARY_HERBIVORE_PET: "needLegendaryHerbivorePet",
	NEED_FIRE_AFFINITY: "needFireAffinity",
	NEED_CARNIVORE_PET: "needCarnivorePet",
	SEED_SLOT_FULL: "seedSlotFull",
	ALL_SEEDS_OBTAINED: "allSeedsObtained",
	NO_PLANT_SPACE: "noPlantSpace",
	REFUSED: "refused",
	NONE: "none"
} as const;

export type SeedConditionKey =
	typeof SEED_CONDITION_SUCCESS[keyof typeof SEED_CONDITION_SUCCESS]
	| typeof SEED_CONDITION_FAILURE[keyof typeof SEED_CONDITION_FAILURE];

export interface PlantType {
	id: PlantId;

	/** Growth time in seconds */
	growthTimeSeconds: number;

	/** Material IDs that this plant can produce when composted */
	compostMaterials: number[];
}

/**
 * Definitions of all 10 plant types.
 * Growth times range from 10 seconds (Common Herb) to 2 weeks (Ancient Tree).
 */
export const PLANT_TYPES: readonly PlantType[] = [
	{
		id: PlantId.COMMON_HERB,
		growthTimeSeconds: 10,
		compostMaterials: [
			52, // Herbe de prairie
			54, // Mousses
			37 // Fil de lin
		]
	},
	{
		id: PlantId.GOLDEN_CLOVER,
		growthTimeSeconds: 30 * TimeConstants.S_TIME.MINUTE,
		compostMaterials: [
			43, // Laiton doré
			59, // Feuilles de chêne
			25 // Coton
		]
	},
	{
		id: PlantId.LUNAR_MOSS,
		growthTimeSeconds: 2 * TimeConstants.S_TIME.HOUR,
		compostMaterials: [
			53, // Pierre de lune
			30, // Lavande séchée
			89 // Bougie blanche
		]
	},
	{
		id: PlantId.IRON_ROOT,
		growthTimeSeconds: 8 * TimeConstants.S_TIME.HOUR,
		compostMaterials: [
			70, // Fer brut
			41, // Racines de gingembre
			81 // Acier
		]
	},
	{
		id: PlantId.NIGHT_MUSHROOM,
		growthTimeSeconds: TimeConstants.S_TIME.DAY,
		compostMaterials: [
			55, // Champignon
			66, // Champignon vénéneux
			36 // Champignon extrêmement vénéneux
		]
	},
	{
		id: PlantId.VENOMOUS_LEAF,
		growthTimeSeconds: 2 * TimeConstants.S_TIME.DAY,
		compostMaterials: [
			10, // Belladone
			17, // Graine de ricin
			38 // Tétrodotoxine de fugu
		]
	},
	{
		id: PlantId.FIRE_BULB,
		growthTimeSeconds: 4 * TimeConstants.S_TIME.DAY,
		compostMaterials: [
			35, // Flamme éternelle
			82, // Soufre
			44 // Poudre à canon
		]
	},
	{
		id: PlantId.MEAT_PLANT,
		growthTimeSeconds: 6 * TimeConstants.S_TIME.DAY,
		compostMaterials: [
			42, // Cuir de chèvre
			48, // Cuir d'agneau
			26 // Cuir de vache
		]
	},
	{
		id: PlantId.CRYSTAL_FLOWER,
		growthTimeSeconds: 10 * TimeConstants.S_TIME.DAY,
		compostMaterials: [
			34, // Rune enchantée
			67, // Pierre précieuse
			69 // Quartz arc-en-ciel
		]
	},
	{
		id: PlantId.ANCIENT_TREE,
		growthTimeSeconds: 14 * TimeConstants.S_TIME.DAY,
		compostMaterials: [
			84, // Planche de teck
			31, // Écorce d'ébène
			18 // Bois de cèdre
		]
	}
] as const;

export const PLANT_SLOT_TYPE = {
	SEED: "seed",
	PLANT: "plant"
} as const;

export type PlantSlotType = typeof PLANT_SLOT_TYPE[keyof typeof PLANT_SLOT_TYPE];

export abstract class PlantConstants {
	/**
	 * Total number of plant types
	 */
	public static readonly PLANT_COUNT = PLANT_TYPES.length;

	/**
	 * Number of destroyed plants required to receive a random material
	 */
	public static readonly DESTROYED_PLANTS_PER_MATERIAL = 5;

	/**
	 * Maximum plant slots in player inventory (before tanner upgrade)
	 */
	public static readonly DEFAULT_PLANT_SLOTS = 1;

	/**
	 * Maximum plant slots after tanner upgrade
	 */
	public static readonly MAX_PLANT_SLOTS = 3;

	/**
	 * Seed slots are always 1 (not upgradeable)
	 */
	public static readonly SEED_SLOTS = 1;

	/**
	 * Price for a plant slot extension at the tanner
	 */
	public static readonly PLANT_SLOT_PRICES = [3000, 8000] as const;

	/**
	 * Plant tiers for the herbalist shop.
	 * Each tier offers one plant per week.
	 */
	public static readonly HERBALIST_TIERS: readonly PlantId[][] = [
		[
			PlantId.COMMON_HERB,
			PlantId.GOLDEN_CLOVER,
			PlantId.LUNAR_MOSS
		],
		[
			PlantId.IRON_ROOT,
			PlantId.NIGHT_MUSHROOM,
			PlantId.VENOMOUS_LEAF
		],
		[
			PlantId.FIRE_BULB,
			PlantId.MEAT_PLANT,
			PlantId.CRYSTAL_FLOWER,
			PlantId.ANCIENT_TREE
		]
	];

	/**
	 * Buy prices at the herbalist for each plant (indexed by PlantId - 1)
	 */
	public static readonly HERBALIST_PRICES: readonly number[] = [
		100, // Herbe commune
		144, // Trèfle doré
		250, // Mousse lunaire
		476, // Racine de fer
		728, // Champignon nocturne
		956, // Feuille venimeuse
		1212, // Bulbe de feu
		1568, // Plante carnivore
		1728, // Fleur de cristal
		2419 // Arbre ancien
	];

	/**
	 * Constants for the daily price variation of herbalist plants.
	 * Uses a sin-based deterministic algorithm similar to the gem-to-money ratio.
	 */
	private static readonly HERBALIST_PRICE_VARIATION = {
		/** Maximum variation as a fraction of the base price (±40%) */
		RANGE_RATIO: 0.4,

		/** Seed range to avoid period repetition */
		SEED_RANGE: 1000,

		/** Large multiplier for sin to produce pseudo-random behavior */
		SIN_RANDOMIZER: 100000
	};

	/**
	 * Get the buy price of a plant at the herbalist shop, with daily variation.
	 * Uses a sin-based deterministic algorithm: prices vary ±20% daily around the base price.
	 * Each plant varies independently thanks to the plant ID being part of the seed.
	 * @param plant - The plant type
	 * @param dayOffset - Number of days in the future (0 = today)
	 */
	public static getHerbalistPrice(plant: PlantType, dayOffset: number = 0): number {
		const basePrice = PlantConstants.HERBALIST_PRICES[plant.id - 1];
		const {
			RANGE_RATIO, SEED_RANGE, SIN_RANDOMIZER
		} = PlantConstants.HERBALIST_PRICE_VARIATION;

		const dailyFactor = frac(100 * Math.sin(SIN_RANDOMIZER * ((getDayNumber() + dayOffset) % SEED_RANGE) + plant.id));

		// dailyFactor is in [0, 1), map to [-RANGE_RATIO, +RANGE_RATIO]
		const variation = RANGE_RATIO * 2 * dailyFactor - RANGE_RATIO;

		return Math.round(basePrice * (1 + variation));
	}

	/**
	 * Get the 3 plants available at the herbalist this week (one per tier).
	 * Uses a deterministic seed based on the ISO week number.
	 */
	public static getWeeklyHerbalistPlants(date: Date = new Date()): PlantType[] {
		let seed = PlantConstants.getIsoWeekNumber(date);
		seed += date.getFullYear() * 100;

		const plants: PlantType[] = [];
		for (const tier of PlantConstants.HERBALIST_TIERS) {
			const index = (seed * 9301 + 49297) % 233280 % tier.length;
			const plantType = PlantConstants.getPlantById(tier[index]);
			if (plantType) {
				plants.push(plantType);
			}
			seed += 1;
		}
		return plants;
	}

	/**
	 * Get ISO week number (1-53) for a given date
	 */
	private static getIsoWeekNumber(date: Date): number {
		const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
		d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
		const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
		return Math.ceil(((d.getTime() - yearStart.getTime()) / TimeConstants.MS_TIME.DAY + 1) / 7);
	}

	/**
	 * Get a plant type by its ID. Returns undefined for 0 (empty slot) or unknown IDs.
	 */
	public static getPlantById(id: PlantId | 0): PlantType | undefined {
		return PLANT_TYPES.find(p => p.id === id);
	}

	/**
	 * Get all plant types
	 */
	public static getAllPlants(): readonly PlantType[] {
		return PLANT_TYPES;
	}

	/**
	 * Loot weights for each plant (higher = more common to loot).
	 * Plant 1 is very common, plant 10 is very rare.
	 */
	public static readonly PLANT_LOOT_WEIGHTS: Readonly<Record<PlantId, number>> = {
		[PlantId.COMMON_HERB]: 100,
		[PlantId.GOLDEN_CLOVER]: 70,
		[PlantId.LUNAR_MOSS]: 50,
		[PlantId.IRON_ROOT]: 35,
		[PlantId.NIGHT_MUSHROOM]: 22,
		[PlantId.VENOMOUS_LEAF]: 15,
		[PlantId.FIRE_BULB]: 10,
		[PlantId.MEAT_PLANT]: 5,
		[PlantId.CRYSTAL_FLOWER]: 3,
		[PlantId.ANCIENT_TREE]: 1
	};

	/**
	 * Roll a random plant weighted by rarity (common plants appear more often).
	 */
	public static lootRandomPlant(random: { integer: (min: number, max: number) => number }): PlantId {
		const weights = PlantConstants.PLANT_LOOT_WEIGHTS;
		let totalWeight = 0;
		for (const plant of PLANT_TYPES) {
			totalWeight += weights[plant.id];
		}
		let roll = random.integer(0, totalWeight - 1);
		for (const plant of PLANT_TYPES) {
			roll -= weights[plant.id];
			if (roll < 0) {
				return plant.id;
			}
		}
		return PlantId.COMMON_HERB;
	}

	/**
	 * Seed quest: minimum player level required for each seed
	 */
	public static readonly SEED_LEVEL_REQUIREMENTS: Readonly<Record<PlantId, number>> = {
		[PlantId.COMMON_HERB]: 8,
		[PlantId.GOLDEN_CLOVER]: 15,
		[PlantId.LUNAR_MOSS]: 22,
		[PlantId.IRON_ROOT]: 30,
		[PlantId.NIGHT_MUSHROOM]: 38,
		[PlantId.VENOMOUS_LEAF]: 48,
		[PlantId.FIRE_BULB]: 58,
		[PlantId.MEAT_PLANT]: 68,
		[PlantId.CRYSTAL_FLOWER]: 85,
		[PlantId.ANCIENT_TREE]: 100
	};

	/**
	 * Seed quest: cost in money for paid seeds (0 = free)
	 */
	public static readonly SEED_COSTS: Readonly<Record<PlantId, number>> = {
		[PlantId.COMMON_HERB]: 0,
		[PlantId.GOLDEN_CLOVER]: 250,
		[PlantId.LUNAR_MOSS]: 0,
		[PlantId.IRON_ROOT]: 850,
		[PlantId.NIGHT_MUSHROOM]: 0,
		[PlantId.VENOMOUS_LEAF]: 0,
		[PlantId.FIRE_BULB]: 0,
		[PlantId.MEAT_PLANT]: 0,
		[PlantId.CRYSTAL_FLOWER]: 2500,
		[PlantId.ANCIENT_TREE]: 0
	};

	/**
	 * Map link IDs where the gardener NPC can appear.
	 * Link 8: Plains(3) → Forest(4)
	 * Link 46: Village(17) → Forest(27)
	 * Link 32: Forest(22) → Lake(14)
	 */
	public static readonly GARDENER_MAP_LINKS: readonly number[] = [
		8,
		46,
		32
	];

	/**
	 * Fire-themed item IDs that satisfy the Fire Bulb seed condition.
	 */
	public static readonly FIRE_ITEM_IDS = {
		WEAPONS: [
			64,
			89,
			97
		],
		ARMORS: [70],
		OBJECTS: [72]
	} as const;
}
