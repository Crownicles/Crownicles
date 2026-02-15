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

	/** Fallback emoji when custom emote is unavailable */
	fallbackEmote: string;

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
		fallbackEmote: "🌿",
		compostMaterials: [
			52,
			54,
			37
		]
	},
	{
		id: PlantId.GOLDEN_CLOVER,
		growthTimeSeconds: 30 * 60,
		fallbackEmote: "☘️",
		compostMaterials: [
			43,
			59,
			25
		]
	},
	{
		id: PlantId.LUNAR_MOSS,
		growthTimeSeconds: 2 * 60 * 60,
		fallbackEmote: "🌙",
		compostMaterials: [
			53,
			30,
			89
		]
	},
	{
		id: PlantId.IRON_ROOT,
		growthTimeSeconds: 8 * 60 * 60,
		fallbackEmote: "🌱",
		compostMaterials: [
			70,
			41,
			81
		]
	},
	{
		id: PlantId.NIGHT_MUSHROOM,
		growthTimeSeconds: 24 * 60 * 60,
		fallbackEmote: "🍄",
		compostMaterials: [
			55,
			66,
			36
		]
	},
	{
		id: PlantId.VENOMOUS_LEAF,
		growthTimeSeconds: 2 * 24 * 60 * 60,
		fallbackEmote: "🍃",
		compostMaterials: [
			10,
			17,
			38
		]
	},
	{
		id: PlantId.FIRE_BULB,
		growthTimeSeconds: 4 * 24 * 60 * 60,
		fallbackEmote: "🔥",
		compostMaterials: [
			35,
			82,
			44
		]
	},
	{
		id: PlantId.MEAT_PLANT,
		growthTimeSeconds: 6 * 24 * 60 * 60,
		fallbackEmote: "🥩",
		compostMaterials: [
			42,
			48,
			26
		]
	},
	{
		id: PlantId.CRYSTAL_FLOWER,
		growthTimeSeconds: 10 * 24 * 60 * 60,
		fallbackEmote: "💎",
		compostMaterials: [
			34,
			67,
			69
		]
	},
	{
		id: PlantId.ANCIENT_TREE,
		growthTimeSeconds: 14 * 24 * 60 * 60,
		fallbackEmote: "🌳",
		compostMaterials: [
			84,
			31,
			18
		]
	}
] as const;

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
	 * Get a plant type by its ID
	 */
	public static getPlantById(id: PlantId): PlantType | undefined {
		return PLANT_TYPES.find(p => p.id === id);
	}

	/**
	 * Get all plant types
	 */
	public static getAllPlants(): readonly PlantType[] {
		return PLANT_TYPES;
	}
}
