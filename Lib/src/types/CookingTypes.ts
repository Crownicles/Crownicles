import { PlantId } from "../constants/PlantConstants";
import {
	CookingOutputTypeValue, RecipeType
} from "../constants/CookingConstants";
import { PetFood } from "./PetFood";

export interface RecipeIngredients {
	plants: {
		plantId: PlantId; quantity: number; playerHas: number;
	}[];
	materials: {
		materialId: number; quantity: number; playerHas: number;
	}[];
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
