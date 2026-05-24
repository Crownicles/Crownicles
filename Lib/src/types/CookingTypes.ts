import { PlantId } from "../constants/PlantConstants";
import {
	CookingOutputTypeValue, RecipeType
} from "../constants/CookingConstants";
import { PetFood } from "./PetFood";
import { MaterialQuantity } from "./MaterialQuantity";

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
		id: string;
		level: number;
		isSecret: boolean;
		outputDescription: string;
		outputType: CookingOutputTypeValue;
		recipeType: RecipeType;
		petFoodType?: PetFood;
		ingredients: RecipeIngredients;
		canCraft: boolean;
	} | null;
}

export type RecipeSlotData = NonNullable<CookingSlotData["recipe"]>;

export const CookingCraftErrors = {
	CRAFT_UNAVAILABLE: "craftUnavailable",
	INVENTORY_FULL: "inventoryFull",
	GUILD_REQUIRED: "guildRequired",
	GUILD_STORAGE_FULL: "guildStorageFull"
} as const;

export type CookingCraftError = typeof CookingCraftErrors[keyof typeof CookingCraftErrors];

export interface PinnedRecipeInfo {
	recipeId: string;
	level: number;
	recipeType: RecipeType;
	outputType: CookingOutputTypeValue;
	ingredients: RecipeIngredients;
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
	currentSlots: CookingSlotData[];
	isIgnited: boolean;
}
