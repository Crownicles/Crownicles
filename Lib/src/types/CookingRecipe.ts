import { PlantId } from "../constants/PlantConstants";
import {
	ItemNature, ItemRarity
} from "../constants/ItemConstants";
import {
	RecipeType, RecipeDiscoverySource, CookingOutputTypeValue
} from "../constants/CookingConstants";

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
	petFoodType?: string;
	petFoodQuantity?: number;
	petFoodLovePoints?: number;
	discoveredByDefault: boolean;
	discoverySource?: RecipeDiscoverySource;
}
