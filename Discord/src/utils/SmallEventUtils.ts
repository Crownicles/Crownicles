import { Language } from "../../../Lib/src/Language";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import i18n from "../translations/i18n";
import { StringUtils } from "./StringUtils";

/**
 * Returns a random intro for any small event, using the translations defined in `smallEvents:intro`.
 */
export function getRandomSmallEventIntro(language: Language): string {
	return StringUtils.getRandomTranslation("smallEvents:intro", language);
}

/**
 * Build the "recipe discovered" message shown after certain small events
 */
export function buildRecipeDiscoveryMessage(recipeId: string, lng: Language, recipeCost?: number): string {
	let recipeMsg = i18n.t("commands:report.city.homes.cooking.recipeDiscovered", {
		lng,
		recipe: i18n.t(`models:cooking.recipes.${recipeId}`, { lng })
	});
	if (recipeCost !== undefined) {
		recipeMsg += ` (${recipeCost} ${CrowniclesIcons.unitValues.money})`;
	}
	return recipeMsg;
}
