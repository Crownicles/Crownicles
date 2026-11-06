import { PlantId } from "../constants/PlantConstants";
import {
	CookingOutputTypeValue, RecipeType
} from "../constants/CookingConstants";
import { PetFood } from "./PetFood";
import { MaterialQuantity } from "./MaterialQuantity";
import type { CookingRecipeId } from "./CookingRecipe";

export interface PlantQuantity {
	plantId: PlantId;
	quantity: number;
}

export interface RecipePlantIngredient extends PlantQuantity {
	playerHas: number;
}

export interface RecipeMaterialIngredient extends MaterialQuantity {
	playerHas: number;
}

export interface RecipeIngredients {
	plants: RecipePlantIngredient[];
	materials: RecipeMaterialIngredient[];
}

export interface CookingSlotData {
	slotIndex: number;
	recipe: {
		id: CookingRecipeId;
		level: number;
		isSecret: boolean;
		outputDescription: string;
		outputType: CookingOutputTypeValue;
		recipeType: RecipeType;
		petFoodType?: PetFood;
		ingredients: RecipeIngredients;
		canCraft: boolean;

		/** Time potions the player can still cook this week, only set on time potion recipes */
		timePotionsLeftThisWeek?: number;
	} | null;
}

export type RecipeSlotData = NonNullable<CookingSlotData["recipe"]>;

export const CookingCraftErrors = {
	CRAFT_UNAVAILABLE: "craftUnavailable",
	INVENTORY_FULL: "inventoryFull",
	GUILD_REQUIRED: "guildRequired",
	GUILD_STORAGE_FULL: "guildStorageFull",
	TIME_POTION_WEEKLY_LIMIT: "timePotionWeeklyLimit"
} as const;

export type CookingCraftError = typeof CookingCraftErrors[keyof typeof CookingCraftErrors];

export const CookingSpecialtyErrors = {
	LIMIT_REACHED: "specialtyLimitReached",
	UNAVAILABLE: "specialtyUnavailable"
} as const;

export type CookingSpecialtyError = typeof CookingSpecialtyErrors[keyof typeof CookingSpecialtyErrors];

/**
 * Minimal recipe info needed to render a recipe as "{icon} Name (level)".
 */
export interface RecipeDisplayInfo {
	recipeId: CookingRecipeId;
	level: number;
	recipeType: RecipeType;
}

export interface PinnedRecipeInfo {
	recipeId: CookingRecipeId;
	level: number;
	recipeType: RecipeType;
	outputType: CookingOutputTypeValue;
	ingredients: RecipeIngredients;
	canCraft: boolean;
}

/**
 * A recipe the master chef made one of their specialties, offered on the specialty station at every furnace ignition
 */
export interface CookingSpecialtyInfo extends RecipeDisplayInfo {
	canCraft: boolean;
}

/**
 * Authoritative snapshot of the cooking feature's state, produced by Core
 * and consumed by Discord as the single source of truth for every cooking
 * render. The Discord client must NOT keep any cached cooking state of its
 * own: every Core response carries a fresh snapshot, and the renderer
 * picks the appropriate view based purely on `isIgnited`.
 *
 * - `isIgnited === false`: the furnace is unlit, render the pre-ignite menu.
 * `currentSlots` MUST be empty in this case.
 * - `isIgnited === true`: the furnace is lit, render the ignited menu with
 * `currentSlots` displayed as craftable rows.
 */
export interface CookingMenuSnapshot {
	cookingLevel: number;
	cookingGrade: string;
	pinnedRecipe?: PinnedRecipeInfo;

	/** Omitted while the player has no specialty */
	specialties?: CookingSpecialtyInfo[];
	currentSlots: CookingSlotData[];
	isIgnited: boolean;
}
