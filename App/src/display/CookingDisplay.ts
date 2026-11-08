import {
	CookingMenu, CookingSlot
} from "ws-packets/src/objects/Cooking";
import { AppIcons } from "@/src/AppIcons";
import { i18n } from "@/src/translations/i18n";

export type SlotRecipe = NonNullable<CookingSlot["recipe"]>;

export function recipeName(recipeId: string): string {
	return i18n.t(`models:cooking.recipes.${recipeId}`);
}

/** The station Core keeps for the specialties, after the rotating ones: it is named after the chef's specialty. */
export function specialtyStationName(menu: CookingMenu): string {
	return i18n.t(`models:cooking.stations.${menu.rules.specialtyStation}`);
}

export function specialtyStationIcon(menu: CookingMenu): string | null {
	return AppIcons.getIconOrNull(`cookingStations.${menu.rules.specialtyStation}`);
}

export function isSpecialtyStation(slot: CookingSlot, menu: CookingMenu): boolean {
	return slot.slotIndex === menu.rules.specialtyStation;
}

/**
 * How many time potions can still be cooked this week, told on a time potion recipe once few remain. A secret
 * recipe keeps its secret, and none left is a lock rather than a count.
 */
export function timePotionsNotice(recipe: SlotRecipe, menu: CookingMenu): string | undefined {
	const left = recipe.timePotionsLeftThisWeek;
	if (left === undefined || left === 0 || recipe.isSecret || left > menu.rules.timePotionsShownFrom) {
		return undefined;
	}
	return i18n.t("app:cooking.timePotionsLeft", { count: left });
}

/** Which of the specialties the station offers this time, when there are several to cycle through. */
export function specialtyRotation(slot: CookingSlot, menu: CookingMenu): string | undefined {
	const specialties = menu.specialties ?? [];
	if (!isSpecialtyStation(slot, menu) || specialties.length < 2) {
		return undefined;
	}
	return i18n.t("app:cooking.specialties.rotation", {
		current: specialties.findIndex(specialty => specialty.recipeId === slot.recipe?.id) + 1, total: specialties.length
	});
}
