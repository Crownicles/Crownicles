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
			52, // Herbe de prairie
			54, // Mousses
			37 // Fil de lin
		]
	},
	{
		id: PlantId.GOLDEN_CLOVER,
		growthTimeSeconds: 30 * 60,
		fallbackEmote: "☘️",
		compostMaterials: [
			43, // Laiton doré
			59, // Feuilles de chêne
			25 // Coton
		]
	},
	{
		id: PlantId.LUNAR_MOSS,
		growthTimeSeconds: 2 * 60 * 60,
		fallbackEmote: "🌙",
		compostMaterials: [
			53, // Pierre de lune
			30, // Lavande séchée
			89 // Bougie blanche
		]
	},
	{
		id: PlantId.IRON_ROOT,
		growthTimeSeconds: 8 * 60 * 60,
		fallbackEmote: "🌱",
		compostMaterials: [
			70, // Fer brut
			41, // Racines de gingembre
			81 // Acier
		]
	},
	{
		id: PlantId.NIGHT_MUSHROOM,
		growthTimeSeconds: 24 * 60 * 60,
		fallbackEmote: "🍄",
		compostMaterials: [
			55, // Champignon
			66, // Champignon vénéneux
			36 // Champignon extrêmement vénéneux
		]
	},
	{
		id: PlantId.VENOMOUS_LEAF,
		growthTimeSeconds: 2 * 24 * 60 * 60,
		fallbackEmote: "🍃",
		compostMaterials: [
			10, // Belladone
			17, // Graine de ricin
			38 // Tétrodotoxine de fugu
		]
	},
	{
		id: PlantId.FIRE_BULB,
		growthTimeSeconds: 4 * 24 * 60 * 60,
		fallbackEmote: "🔥",
		compostMaterials: [
			35, // Flamme éternelle
			82, // Soufre
			44 // Poudre à canon
		]
	},
	{
		id: PlantId.MEAT_PLANT,
		growthTimeSeconds: 6 * 24 * 60 * 60,
		fallbackEmote: "🥩",
		compostMaterials: [
			42, // Cuir de chèvre
			48, // Cuir d'agneau
			26 // Cuir de vache
		]
	},
	{
		id: PlantId.CRYSTAL_FLOWER,
		growthTimeSeconds: 10 * 24 * 60 * 60,
		fallbackEmote: "💎",
		compostMaterials: [
			34, // Rune enchantée
			67, // Pierre précieuse
			69 // Quartz arc-en-ciel
		]
	},
	{
		id: PlantId.ANCIENT_TREE,
		growthTimeSeconds: 14 * 24 * 60 * 60,
		fallbackEmote: "🌳",
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
		576, // Racine de fer
		1728, // Champignon nocturne
		3456, // Feuille venimeuse
		6912, // Bulbe de feu
		10368, // Plante carnivore
		17280, // Fleur de cristal
		24192 // Arbre ancien
	];

	/**
	 * Get the buy price of a plant at the herbalist shop
	 */
	public static getHerbalistPrice(plant: PlantType): number {
		return PlantConstants.HERBALIST_PRICES[plant.id - 1];
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
		return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
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
}
