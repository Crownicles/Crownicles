import { TimeConstants } from "./TimeConstants";

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
