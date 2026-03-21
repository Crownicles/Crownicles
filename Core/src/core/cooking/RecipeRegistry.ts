import * as fs from "fs";
import { CookingRecipe } from "../../../../Lib/src/types/CookingRecipe";
import { RecipeType } from "../../../../Lib/src/constants/CookingConstants";

class RecipeRegistry {
	private recipes: CookingRecipe[] = [];

	private recipeById: Map<string, CookingRecipe> = new Map();

	private recipesByType: Map<RecipeType, CookingRecipe[]> = new Map();

	constructor() {
		this.load();
	}

	private load(): void {
		const data = JSON.parse(fs.readFileSync("resources/cooking/recipes.json", "utf-8")) as CookingRecipe[];
		this.recipes = data;
		for (const recipe of data) {
			this.recipeById.set(recipe.id, recipe);
			const existing = this.recipesByType.get(recipe.recipeType) ?? [];
			existing.push(recipe);
			this.recipesByType.set(recipe.recipeType, existing);
		}
	}

	getById(id: string): CookingRecipe | undefined {
		return this.recipeById.get(id);
	}

	getByType(type: RecipeType): CookingRecipe[] {
		return this.recipesByType.get(type) ?? [];
	}

	getByTypeAndLevelRange(type: RecipeType, minLevel: number, maxLevel: number): CookingRecipe[] {
		return this.getByType(type).filter(r => r.level >= minLevel && r.level <= maxLevel);
	}

	getAll(): CookingRecipe[] {
		return this.recipes;
	}
}

export const recipeRegistry = new RecipeRegistry();
