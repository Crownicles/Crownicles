import { PlantId } from "../constants/PlantConstants";
import {
	ItemNature, ItemRarity
} from "../constants/ItemConstants";
import {
	RecipeType, RecipeDiscoverySource, CookingOutputTypeValue
} from "../constants/CookingConstants";
import { PetFood } from "../types/PetFood";

export interface CookingRecipeMaterial {
	materialId: number;
	quantity: number;
}

export interface CookingRecipePlant {
	plantId: PlantId;
	quantity: number;
}

export interface CookingRecipe {
	id: string;
	level: number;
	recipeType: RecipeType;
	plants: CookingRecipePlant[];
	materials: CookingRecipeMaterial[];
	outputType: CookingOutputTypeValue;
	potionNature?: ItemNature;
	potionRarity?: ItemRarity;
	petFoodType?: PetFood;
	petFoodQuantity?: number;
	petFoodLovePoints?: number;
	outputMaterialId?: number;
	outputMaterialQuantity?: number;
	discoveredByDefault: boolean;
	discoverySource?: RecipeDiscoverySource;
}
