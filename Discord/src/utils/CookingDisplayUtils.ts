import { Language } from "../../../Lib/src/Language";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { RecipeDisplayInfo } from "../../../Lib/src/types/CookingTypes";
import i18n from "../translations/i18n";

/**
 * Render a recipe the way the rest of the game renders obtained entities: its own icon,
 * its name and the cooking level needed to prepare it.
 * @param recipe
 * @param lng
 */
export function formatRecipe(recipe: RecipeDisplayInfo, lng: Language): string {
	return i18n.t("models:cooking.recipeDisplay", {
		lng,
		recipeId: recipe.recipeId,
		recipeType: recipe.recipeType,
		level: recipe.level
	});
}

/**
 * Build the "recipe discovered" message shown wherever a player learns cooking recipes
 * (cooking level up, small events, level milestones, campaign milestones, island bosses).
 * @param recipes the recipes just learned, empty yielding an empty message
 * @param lng
 * @param recipeCost price paid for the recipe, when it was bought
 */
export function buildRecipeDiscoveryMessage(recipes: RecipeDisplayInfo[], lng: Language, recipeCost?: number): string {
	if (recipes.length === 0) {
		return "";
	}

	if (recipes.length > 1) {
		return i18n.t("commands:report.city.homes.cooking.recipesDiscovered", {
			lng,
			recipes: recipes.map(recipe => `**${formatRecipe(recipe, lng)}**`)
				.join(", ")
		});
	}

	const recipeMsg = i18n.t("commands:report.city.homes.cooking.recipeDiscovered", {
		lng,
		recipe: formatRecipe(recipes[0], lng)
	});
	return recipeCost === undefined ? recipeMsg : `${recipeMsg} (${recipeCost} ${CrowniclesIcons.unitValues.money})`;
}
