import { Language } from "../../../Lib/src/Language";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import i18n from "../translations/i18n";

/**
 * Build the "recipe discovered" message shown wherever a player learns cooking recipes
 * (cooking level up, small events, level milestones, campaign milestones, island bosses).
 * @param recipeIds the recipes just learned, empty yielding an empty message
 * @param lng
 * @param recipeCost price paid for the recipe, when it was bought
 */
export function buildRecipeDiscoveryMessage(recipeIds: string[], lng: Language, recipeCost?: number): string {
	if (recipeIds.length === 0) {
		return "";
	}

	if (recipeIds.length > 1) {
		return i18n.t("commands:report.city.homes.cooking.recipesDiscovered", {
			lng,
			recipes: recipeIds.map(recipeId => `**${i18n.t(`models:cooking.recipes.${recipeId}`, { lng })}**`)
				.join(", ")
		});
	}

	const recipeMsg = i18n.t("commands:report.city.homes.cooking.recipeDiscovered", {
		lng,
		recipe: i18n.t(`models:cooking.recipes.${recipeIds[0]}`, { lng })
	});
	return recipeCost === undefined ? recipeMsg : `${recipeMsg} (${recipeCost} ${CrowniclesIcons.unitValues.money})`;
}
