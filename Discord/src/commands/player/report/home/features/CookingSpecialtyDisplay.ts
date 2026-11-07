import {
	ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, parseEmoji
} from "discord.js";
import i18n from "../../../../../translations/i18n";
import { StringUtils } from "../../../../../utils/StringUtils";
import { buildCustomId } from "../../../../../utils/CustomIdUtils";
import { CrowniclesIcons } from "../../../../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../../../../Lib/src/Language";
import {
	getCookingSpecialtiesLimit, getNextCookingSpecialtyUnlockLevel, hasUnlockedCookingSpecialties,
	SPECIALTY_SLOT_INDEX, TIME_POTION_WEEKLY_LIMIT_DISPLAY_THRESHOLD
} from "../../../../../../../Lib/src/constants/CookingConstants";
import {
	CookingSlotData, CookingSpecialtyInfo, RecipeSlotData
} from "../../../../../../../Lib/src/types/CookingTypes";
import type { CookingRecipeId } from "../../../../../../../Lib/src/types/CookingRecipe";
import { HomeMenuIds } from "../HomeMenuConstants";

/**
 * Cooking state needed to render the specialties
 */
export interface CookingSpecialtyDisplayState {
	cookingLevel: number;
	specialties: CookingSpecialtyInfo[];
	currentSlots: CookingSlotData[];
}

interface SpecialtyOption {
	recipeId: CookingRecipeId;
	level: number;
	descriptionKey: string;
	value: string;
	emoji: string;
}

export function isSpecialtySlot(slot: CookingSlotData): boolean {
	return slot.slotIndex === SPECIALTY_SLOT_INDEX;
}

/**
 * Keep the slot and recipe in one custom-ID part because buildCustomId uses
 * underscores to separate multiple parts.
 */
export function buildSlotRecipeCustomId(prefix: string, slotIndex: number, recipeId: CookingRecipeId): string {
	return buildCustomId(prefix, `${slotIndex}:${recipeId}`);
}

/**
 * Line announcing the cooking level unlocking the next specialty, null once they are all unlocked
 */
function buildNextSpecialtyUnlockLine(cookingLevel: number, lng: Language): string | null {
	const nextUnlockLevel = getNextCookingSpecialtyUnlockLevel(cookingLevel);
	return nextUnlockLevel === null
		? null
		: i18n.t("commands:report.city.homes.cooking.specialtyNextUnlock", {
			lng,
			level: nextUnlockLevel
		});
}

/**
 * Build the specialties block of the pre-ignite menu, empty while they are not unlocked
 */
export function buildSpecialtiesDisplay(state: CookingSpecialtyDisplayState, lng: Language): string {
	if (!hasUnlockedCookingSpecialties(state.cookingLevel)) {
		return "";
	}
	const specialtiesLimit = getCookingSpecialtiesLimit(state.cookingLevel);
	const header = state.specialties.length === 0
		? i18n.t("commands:report.city.homes.cooking.specialtiesNone", {
			lng,
			count: specialtiesLimit
		})
		: i18n.t("commands:report.city.homes.cooking.specialtiesTitle", {
			lng,
			current: state.specialties.length,
			max: specialtiesLimit
		});
	return StringUtils.joinLines([
		header,
		...state.specialties.map(specialty => i18n.t("commands:report.city.homes.cooking.specialtyLine", {
			lng,
			recipeId: specialty.recipeId,
			recipeType: specialty.recipeType,
			level: specialty.level
		}) + (specialty.canCraft ? ` ${CrowniclesIcons.collectors.accept}` : "")),
		buildNextSpecialtyUnlockLine(state.cookingLevel, lng)
	]);
}

/**
 * Line telling which of the specialties the specialty station offers, when there are several to cycle through
 */
export function buildSpecialtyRotationLine(slot: CookingSlotData, specialties: CookingSpecialtyInfo[], lng: Language): string | null {
	if (!isSpecialtySlot(slot) || specialties.length < 2) {
		return null;
	}
	return i18n.t("commands:report.city.homes.cooking.specialtyRotation", {
		lng,
		current: specialties.findIndex(specialty => specialty.recipeId === slot.recipe?.id) + 1,
		total: specialties.length
	});
}

/**
 * Line telling how many time potions can still be cooked this week, only on time potion recipes and once
 * few remain. A secret recipe only gets it once the limit is reached, to explain why it can't be cooked.
 */
export function buildTimePotionLine(recipe: RecipeSlotData, lng: Language): string | null {
	if (recipe.timePotionsLeftThisWeek === undefined) {
		return null;
	}
	if (recipe.timePotionsLeftThisWeek === 0) {
		return i18n.t("commands:report.city.homes.cooking.timePotionsExhausted", { lng });
	}
	return recipe.isSecret || recipe.timePotionsLeftThisWeek > TIME_POTION_WEEKLY_LIMIT_DISPLAY_THRESHOLD
		? null
		: i18n.t("commands:report.city.homes.cooking.timePotionsLeft", {
			lng,
			count: recipe.timePotionsLeftThisWeek
		});
}

function buildSpecialtyOption(option: SpecialtyOption, lng: Language): StringSelectMenuOptionBuilder {
	return new StringSelectMenuOptionBuilder()
		.setLabel(i18n.t("commands:report.city.homes.cooking.specialtyOptionLabel", {
			lng,
			recipeId: option.recipeId,
			level: option.level
		}))
		.setDescription(i18n.t(`commands:report.city.homes.cooking.${option.descriptionKey}`, { lng }))
		.setValue(option.value)
		.setEmoji(parseEmoji(option.emoji)!);
}

/**
 * Options making a visible recipe of the rotating stations a specialty, while the limit is not reached
 */
function buildSetSpecialtyOptions(state: CookingSpecialtyDisplayState, lng: Language): StringSelectMenuOptionBuilder[] {
	if (state.specialties.length >= getCookingSpecialtiesLimit(state.cookingLevel)) {
		return [];
	}
	return state.currentSlots
		.filter((slot): slot is CookingSlotData & { recipe: RecipeSlotData } => slot.recipe !== null && !slot.recipe.isSecret && !isSpecialtySlot(slot))
		.map(slot => buildSpecialtyOption({
			recipeId: slot.recipe.id,
			level: slot.recipe.level,
			descriptionKey: "specialtySetDescription",
			value: buildSlotRecipeCustomId(HomeMenuIds.COOKING_SPECIALTY_SET_PREFIX, slot.slotIndex, slot.recipe.id),
			emoji: CrowniclesIcons.cookingStations[SPECIALTY_SLOT_INDEX]
		}, lng));
}

function buildRemoveSpecialtyOptions(specialties: CookingSpecialtyInfo[], lng: Language): StringSelectMenuOptionBuilder[] {
	return specialties.map(specialty => buildSpecialtyOption({
		recipeId: specialty.recipeId,
		level: specialty.level,
		descriptionKey: "specialtyRemoveDescription",
		value: buildCustomId(HomeMenuIds.COOKING_SPECIALTY_REMOVE_PREFIX, specialty.recipeId),
		emoji: CrowniclesIcons.collectors.refuse
	}, lng));
}

/**
 * Select menu managing the specialties, null when there is nothing to manage. New specialties can only
 * be chosen among the recipes of the ignited furnace, existing ones can be removed from both menus.
 */
export function buildSpecialtySelectRow(
	state: CookingSpecialtyDisplayState,
	lng: Language,
	fromIgnitedView: boolean
): ActionRowBuilder<StringSelectMenuBuilder> | null {
	if (!hasUnlockedCookingSpecialties(state.cookingLevel)) {
		return null;
	}
	const options = [
		...fromIgnitedView ? buildSetSpecialtyOptions(state, lng) : [],
		...buildRemoveSpecialtyOptions(state.specialties, lng)
	];
	if (options.length === 0) {
		return null;
	}
	return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
		new StringSelectMenuBuilder()
			.setCustomId(HomeMenuIds.COOKING_SPECIALTY_SELECT)
			.setPlaceholder(i18n.t("commands:report.city.homes.cooking.specialtySelectPlaceholder", {
				lng,
				current: state.specialties.length,
				max: getCookingSpecialtiesLimit(state.cookingLevel)
			}))
			.addOptions(options)
	);
}
