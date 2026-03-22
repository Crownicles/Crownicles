import { PlantId } from "./PlantConstants";
import { CrowniclesIcons } from "../CrowniclesIcons";

/**
 * Cooking recipe types — each maps to a specific base plant
 */
export enum RecipeType {
	POTION_HEALTH = "POTION_HEALTH",
	POTION_ENERGY = "POTION_ENERGY",
	POTION_TIME_SPEEDUP = "POTION_TIME_SPEEDUP",
	POTION_DEFENSE = "POTION_DEFENSE",
	POTION_ATTACK = "POTION_ATTACK",
	POTION_SPEED = "POTION_SPEED",
	PETFOOD_SALAD = "PETFOOD_SALAD",
	PETFOOD_CANDY = "PETFOOD_CANDY",
	PETFOOD_MEAT = "PETFOOD_MEAT",
	PETFOOD_ULTIMATE = "PETFOOD_ULTIMATE",
	MATERIAL_CRAFT = "MATERIAL_CRAFT"
}

/**
 * Maps each RecipeType to its base plant
 */
export const RECIPE_TYPE_BASE_PLANT: Record<RecipeType, PlantId> = {
	[RecipeType.POTION_HEALTH]: PlantId.COMMON_HERB,
	[RecipeType.POTION_ENERGY]: PlantId.GOLDEN_CLOVER,
	[RecipeType.POTION_TIME_SPEEDUP]: PlantId.LUNAR_MOSS,
	[RecipeType.POTION_DEFENSE]: PlantId.IRON_ROOT,
	[RecipeType.POTION_ATTACK]: PlantId.NIGHT_MUSHROOM,
	[RecipeType.POTION_SPEED]: PlantId.VENOMOUS_LEAF,
	[RecipeType.PETFOOD_SALAD]: PlantId.COMMON_HERB,
	[RecipeType.PETFOOD_CANDY]: PlantId.GOLDEN_CLOVER,
	[RecipeType.PETFOOD_MEAT]: PlantId.MEAT_PLANT,
	[RecipeType.PETFOOD_ULTIMATE]: PlantId.ANCIENT_TREE,
	[RecipeType.MATERIAL_CRAFT]: PlantId.CRYSTAL_FLOWER
};

export enum RecipeDiscoverySource {
	DEFAULT = "DEFAULT",
	ISLAND_BOSS = "ISLAND_BOSS",
	CAMPAIGN_MILESTONE = "CAMPAIGN_MILESTONE",
	PLAYER_LEVEL_MILESTONE = "PLAYER_LEVEL_MILESTONE",
	GASPARD_JO = "GASPARD_JO",
	FARMER = "FARMER",
	COOKING_LEVEL = "COOKING_LEVEL",
	WITCH = "WITCH"
}

export const CookingOutputType = {
	POTION: "potion",
	PET_FOOD: "petFood",
	MATERIAL: "material"
} as const;

export type CookingOutputTypeValue = typeof CookingOutputType[keyof typeof CookingOutputType];

export interface CookingGradeDefinition {
	name: string;
	minLevel: number;
	maxLevel: number;
	emoji: string;
	failureRate: number;
	secretRecipeRate: number;
	maxRecipeLevelWithoutPenalty: number;
	materialSaveChance: number;
	woodSaveChance: number;
}

export const COOKING_GRADES: readonly CookingGradeDefinition[] = [
	{
		name: "aideCuisine",
		minLevel: 0,
		maxLevel: 10,
		emoji: CrowniclesIcons.cookingGrades.aideCuisine,
		failureRate: 0.10,
		secretRecipeRate: 0.20,
		maxRecipeLevelWithoutPenalty: 2,
		materialSaveChance: 0,
		woodSaveChance: 0
	},
	{
		name: "marmiton",
		minLevel: 11,
		maxLevel: 20,
		emoji: CrowniclesIcons.cookingGrades.marmiton,
		failureRate: 0.05,
		secretRecipeRate: 0.10,
		maxRecipeLevelWithoutPenalty: 3,
		materialSaveChance: 0,
		woodSaveChance: 0
	},
	{
		name: "cuisinier",
		minLevel: 21,
		maxLevel: 30,
		emoji: CrowniclesIcons.cookingGrades.cuisinier,
		failureRate: 0.05,
		secretRecipeRate: 0.10,
		maxRecipeLevelWithoutPenalty: 4,
		materialSaveChance: 0.05,
		woodSaveChance: 0
	},
	{
		name: "rotisseur",
		minLevel: 31,
		maxLevel: 40,
		emoji: CrowniclesIcons.cookingGrades.rotisseur,
		failureRate: 0.05,
		secretRecipeRate: 0.05,
		maxRecipeLevelWithoutPenalty: 5,
		materialSaveChance: 0.05,
		woodSaveChance: 0
	},
	{
		name: "saucier",
		minLevel: 41,
		maxLevel: 50,
		emoji: CrowniclesIcons.cookingGrades.saucier,
		failureRate: 0.05,
		secretRecipeRate: 0.05,
		maxRecipeLevelWithoutPenalty: 5,
		materialSaveChance: 0.05,
		woodSaveChance: 0
	},
	{
		name: "maitreOffice",
		minLevel: 51,
		maxLevel: 60,
		emoji: CrowniclesIcons.cookingGrades.maitreOffice,
		failureRate: 0.05,
		secretRecipeRate: 0.05,
		maxRecipeLevelWithoutPenalty: 6,
		materialSaveChance: 0.05,
		woodSaveChance: 0
	},
	{
		name: "chefDeTable",
		minLevel: 61,
		maxLevel: 70,
		emoji: CrowniclesIcons.cookingGrades.chefDeTable,
		failureRate: 0.05,
		secretRecipeRate: 0.05,
		maxRecipeLevelWithoutPenalty: 7,
		materialSaveChance: 0.05,
		woodSaveChance: 0.05
	},
	{
		name: "chefDesFourneaux",
		minLevel: 71,
		maxLevel: 80,
		emoji: CrowniclesIcons.cookingGrades.chefDesFourneaux,
		failureRate: 0.05,
		secretRecipeRate: 0.05,
		maxRecipeLevelWithoutPenalty: 7,
		materialSaveChance: 0.05,
		woodSaveChance: 0.05
	},
	{
		name: "maitreDesCuisines",
		minLevel: 81,
		maxLevel: 90,
		emoji: CrowniclesIcons.cookingGrades.maitreDesCuisines,
		failureRate: 0.05,
		secretRecipeRate: 0.05,
		maxRecipeLevelWithoutPenalty: 8,
		materialSaveChance: 0.05,
		woodSaveChance: 0.05
	},
	{
		name: "grandCuisinierRoyal",
		minLevel: 91,
		maxLevel: Infinity,
		emoji: CrowniclesIcons.cookingGrades.grandCuisinierRoyal,
		failureRate: 0.04,
		secretRecipeRate: 0.005,
		maxRecipeLevelWithoutPenalty: 8,
		materialSaveChance: 0.05,
		woodSaveChance: 0.05
	}
] as const;

/**
 * Get the cooking grade for a given cooking level
 */
export function getCookingGrade(cookingLevel: number): CookingGradeDefinition {
	for (const grade of COOKING_GRADES) {
		if (cookingLevel >= grade.minLevel && cookingLevel <= grade.maxLevel) {
			return grade;
		}
	}
	return COOKING_GRADES[COOKING_GRADES.length - 1];
}

/**
 * XP per plant used in cooking (based on growth time)
 */
export const PLANT_COOKING_XP: Record<PlantId, number> = {
	[PlantId.COMMON_HERB]: 10,
	[PlantId.GOLDEN_CLOVER]: 30,
	[PlantId.LUNAR_MOSS]: 55,
	[PlantId.IRON_ROOT]: 90,
	[PlantId.NIGHT_MUSHROOM]: 140,
	[PlantId.VENOMOUS_LEAF]: 200,
	[PlantId.FIRE_BULB]: 280,
	[PlantId.MEAT_PLANT]: 360,
	[PlantId.CRYSTAL_FLOWER]: 460,
	[PlantId.ANCIENT_TREE]: 580
};

/**
 * XP per material rarity (MaterialRarity enum: COMMON=1, UNCOMMON=2, RARE=3)
 */
export const MATERIAL_RARITY_COOKING_XP: Record<number, number> = {
	1: 15,
	2: 40,
	3: 80
};

export const CookingXpConstants = {
	PLANT_WEIGHT: 0.8,
	MATERIAL_WEIGHT: 0.2,
	FAILURE_XP_PER_LEVEL: 15
} as const;

/**
 * Failure rate penalty multiplier when recipe is above grade limit
 */
export const FAILURE_PENALTY_BASE = 18;

/**
 * Slot configurations for the furnace
 */
export interface SlotConfig {
	minLevel: number;
	maxLevel: number;
	eligibleTypes: readonly RecipeType[];
	potionsOnly: boolean;
}

const ALL_TYPES = [
	RecipeType.POTION_HEALTH,
	RecipeType.POTION_ENERGY,
	RecipeType.POTION_TIME_SPEEDUP,
	RecipeType.POTION_DEFENSE,
	RecipeType.POTION_ATTACK,
	RecipeType.POTION_SPEED,
	RecipeType.PETFOOD_SALAD,
	RecipeType.PETFOOD_CANDY,
	RecipeType.PETFOOD_MEAT,
	RecipeType.PETFOOD_ULTIMATE
] as const;

const ALL_TYPES_EXCEPT_ULTIMATE = [
	RecipeType.POTION_HEALTH,
	RecipeType.POTION_ENERGY,
	RecipeType.POTION_TIME_SPEEDUP,
	RecipeType.POTION_DEFENSE,
	RecipeType.POTION_ATTACK,
	RecipeType.POTION_SPEED,
	RecipeType.PETFOOD_SALAD,
	RecipeType.PETFOOD_CANDY,
	RecipeType.PETFOOD_MEAT
] as const;

const POTION_TYPES_ONLY = [
	RecipeType.POTION_HEALTH,
	RecipeType.POTION_ENERGY,
	RecipeType.POTION_TIME_SPEEDUP,
	RecipeType.POTION_DEFENSE,
	RecipeType.POTION_ATTACK,
	RecipeType.POTION_SPEED
] as const;

const ALL_TYPES_WITH_MATERIALS = [
	...ALL_TYPES,
	RecipeType.MATERIAL_CRAFT
] as const;

export const SLOT_CONFIGS: readonly SlotConfig[] = [
	{
		minLevel: 1,
		maxLevel: 3,
		eligibleTypes: ALL_TYPES_EXCEPT_ULTIMATE,
		potionsOnly: false
	},
	{
		minLevel: 1,
		maxLevel: 5,
		eligibleTypes: ALL_TYPES,
		potionsOnly: false
	},
	{
		minLevel: 1,
		maxLevel: 8,
		eligibleTypes: ALL_TYPES_WITH_MATERIALS,
		potionsOnly: false
	},
	{
		minLevel: 3,
		maxLevel: 8,
		eligibleTypes: POTION_TYPES_ONLY,
		potionsOnly: true
	},
	{
		minLevel: 4,
		maxLevel: 8,
		eligibleTypes: ALL_TYPES_WITH_MATERIALS,
		potionsOnly: false
	}
] as const;

/**
 * Prime seed offsets for per-slot independent permutations
 */
export const SLOT_SEED_OFFSETS = [
	0,
	7919,
	15881,
	23857,
	31847
] as const;

/**
 * Furnace overheat constants
 */
export const FURNACE_MAX_USES_PER_DAY = 10;
export const FURNACE_MIN_OVERHEAT_HOURS = 6;

/**
 * Gaspard Jo recipe costs by grade index (0-9)
 */
export const GASPARD_JO_RECIPE_COSTS = [
	15,
	50,
	100,
	200,
	350,
	500,
	750,
	1000,
	1250,
	1500
] as const;

/**
 * Farmer recipe costs (progressive, fewer than Gaspard Jo)
 */
export const FARMER_RECIPE_COSTS = [
	15,
	50,
	100,
	250,
	500,
	750,
	1000
] as const;
