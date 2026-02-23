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
		growthTimeSeconds: 30 * 60,
		compostMaterials: [
			43, // Laiton doré
			59, // Feuilles de chêne
			25 // Coton
		]
	},
	{
		id: PlantId.LUNAR_MOSS,
		growthTimeSeconds: 2 * 60 * 60,
		compostMaterials: [
			53, // Pierre de lune
			30, // Lavande séchée
			89 // Bougie blanche
		]
	},
	{
		id: PlantId.IRON_ROOT,
		growthTimeSeconds: 8 * 60 * 60,
		compostMaterials: [
			70, // Fer brut
			41, // Racines de gingembre
			81 // Acier
		]
	},
	{
		id: PlantId.NIGHT_MUSHROOM,
		growthTimeSeconds: 24 * 60 * 60,
		compostMaterials: [
			55, // Champignon
			66, // Champignon vénéneux
			36 // Champignon extrêmement vénéneux
		]
	},
	{
		id: PlantId.VENOMOUS_LEAF,
		growthTimeSeconds: 2 * 24 * 60 * 60,
		compostMaterials: [
			10, // Belladone
			17, // Graine de ricin
			38 // Tétrodotoxine de fugu
		]
	},
	{
		id: PlantId.FIRE_BULB,
		growthTimeSeconds: 4 * 24 * 60 * 60,
		compostMaterials: [
			35, // Flamme éternelle
			82, // Soufre
			44 // Poudre à canon
		]
	},
	{
		id: PlantId.MEAT_PLANT,
		growthTimeSeconds: 6 * 24 * 60 * 60,
		compostMaterials: [
			42, // Cuir de chèvre
			48, // Cuir d'agneau
			26 // Cuir de vache
		]
	},
	{
		id: PlantId.CRYSTAL_FLOWER,
		growthTimeSeconds: 10 * 24 * 60 * 60,
		compostMaterials: [
			34, // Rune enchantée
			67, // Pierre précieuse
			69 // Quartz arc-en-ciel
		]
	},
	{
		id: PlantId.ANCIENT_TREE,
		growthTimeSeconds: 14 * 24 * 60 * 60,
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
	public static readonly PLANT_COUNT = 10;

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
}
