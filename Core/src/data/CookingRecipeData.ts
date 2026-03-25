import { DataControllerString } from "./DataController";
import { Data } from "./Data";
import {
	CookingRecipeMaterial, CookingRecipePlant, PetFoodRecipe
} from "../../../Lib/src/types/CookingRecipe";
import {
	CookingOutputTypeValue, RecipeDiscoverySource, RecipeType
} from "../../../Lib/src/constants/CookingConstants";
import {
	ItemNature, ItemRarity
} from "../../../Lib/src/constants/ItemConstants";

export class CookingRecipeData extends Data<string> {
	public readonly level!: number;

	public readonly recipeType!: RecipeType;

	public readonly plants!: CookingRecipePlant[];

	public readonly materials!: CookingRecipeMaterial[];

	public readonly outputType!: CookingOutputTypeValue;

	public readonly potionNature?: ItemNature;

	public readonly potionRarity?: ItemRarity;

	public readonly petFood!: PetFoodRecipe | null;

	public readonly outputMaterialId?: number;

	public readonly outputMaterialQuantity?: number;

	public readonly discoveredByDefault!: boolean;

	public readonly discoverySource?: RecipeDiscoverySource;
}

export class CookingRecipeDataController extends DataControllerString<CookingRecipeData> {
	static readonly instance: CookingRecipeDataController = new CookingRecipeDataController("cooking/recipes");

	private recipesByTypeCache: Map<RecipeType, CookingRecipeData[]> | null = null;

	newInstance(): CookingRecipeData {
		return new CookingRecipeData();
	}

	private getRecipesByTypeMap(): Map<RecipeType, CookingRecipeData[]> {
		if (!this.recipesByTypeCache) {
			this.recipesByTypeCache = new Map();
			for (const recipe of this.getValuesArray()) {
				const existing = this.recipesByTypeCache.get(recipe.recipeType) ?? [];
				existing.push(recipe);
				this.recipesByTypeCache.set(recipe.recipeType, existing);
			}
		}
		return this.recipesByTypeCache;
	}

	getByType(type: RecipeType): CookingRecipeData[] {
		return this.getRecipesByTypeMap().get(type) ?? [];
	}

	getByTypeAndLevelRange(type: RecipeType, minLevel: number, maxLevel: number): CookingRecipeData[] {
		return this.getByType(type).filter(r => r.level >= minLevel && r.level <= maxLevel);
	}

	getAll(): CookingRecipeData[] {
		return this.getValuesArray();
	}
}
