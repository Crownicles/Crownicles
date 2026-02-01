import i18n from "../../../translations/i18n";
import { finishInTimeDisplay } from "../../../../../Lib/src/utils/TimeUtils";
import {
	ExpeditionConstants, ExpeditionLocationType, SpeedCategory
} from "../../../../../Lib/src/constants/ExpeditionConstants";
import { Language } from "../../../../../Lib/src/Language";
import { CrowniclesIcons } from "../../../../../Lib/src/CrowniclesIcons";
import { DisplayUtils } from "../../../utils/DisplayUtils";
import {
	SexTypeShort, StringConstants
} from "../../../../../Lib/src/constants/StringConstants";
import {
	FoodConsumptionDetail,
	CommandPetExpeditionChoicePacketRes
} from "../../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import { PetBasicInfo } from "../../../../../Lib/src/types/PetBasicInfo";
import { ExpeditionOptionData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorPetExpeditionChoice";

/**
 * Expedition option data type for building option text
 */
type ExpeditionOptionLike = Pick<ExpeditionOptionData,
	| "locationType" | "mapLocationId" | "displayDurationMinutes" | "foodCost"
	| "riskRate" | "rewardIndex" | "difficulty" | "isDistantExpedition" | "hasCloneTalismanBonus" | "hasBonusTokens"
>;

/**
 * Format food consumption details for display
 * Returns a string like: "{emote} Friandise: 2 | {emote} Viande: 1"
 */
export function formatFoodConsumedDetails(details: FoodConsumptionDetail[], lng: Language): string {
	if (!details || details.length === 0) {
		return "";
	}

	return details.map(detail => {
		const foodName = i18n.t(`models:foods.${detail.foodType}`, {
			lng,
			count: detail.amount,
			context: "capitalized"
		});
		return `{emote:foods.${detail.foodType}} ${foodName}: ${detail.amount}`;
	}).join(" | ");
}

/**
 * Get the sex context string for i18n translations (male/female)
 */
export function getSexContext(sex: SexTypeShort): string {
	return sex === StringConstants.SEX.MALE.short ? StringConstants.SEX.MALE.long : StringConstants.SEX.FEMALE.long;
}

/**
 * Get translated risk category name for display
 */
export function getTranslatedRiskCategoryName(riskRate: number, lng: Language): string {
	const categoryKey = ExpeditionConstants.getRiskCategoryName(riskRate);
	return i18n.t(`commands:petExpedition.riskCategories.${categoryKey}`, { lng });
}

/**
 * Get the emoji for a risk category
 */
export function getRiskEmoji(riskRate: number): string {
	const categoryKey = ExpeditionConstants.getRiskCategoryName(riskRate) as keyof typeof CrowniclesIcons.expedition.risk;
	return CrowniclesIcons.expedition.risk[categoryKey];
}

/**
 * Get translated risk category name with emoji for display (useful for missions)
 */
export function getTranslatedRiskCategoryNameWithEmoji(riskRate: number, lng: Language): string {
	return `${getRiskEmoji(riskRate)} ${getTranslatedRiskCategoryName(riskRate, lng)}`;
}

/**
 * Get translated reward category name for display based on reward index
 */
export function getTranslatedRewardCategoryName(rewardIndex: number, lng: Language): string {
	const categoryKey = ExpeditionConstants.getRewardCategoryName(rewardIndex);
	return i18n.t(`commands:petExpedition.rewardCategories.${categoryKey}`, { lng });
}

/**
 * Get translated terrain category name for display
 */
export function getTranslatedTerrainCategoryName(difficulty: number, lng: Language): string {
	const categoryKey = ExpeditionConstants.getDifficultyCategoryName(difficulty);
	return i18n.t(`commands:petExpedition.terrainCategories.${categoryKey}`, { lng });
}

/**
 * Get the emoji for a terrain category
 */
export function getTerrainEmoji(difficulty: number): string {
	const categoryKey = ExpeditionConstants.getDifficultyCategoryName(difficulty) as keyof typeof CrowniclesIcons.expedition.terrain;
	return CrowniclesIcons.expedition.terrain[categoryKey];
}

/**
 * Get the display name for an expedition location
 * Uses the stylized expedition name based on mapLocationId
 */
export function getExpeditionLocationName(
	lng: Language,
	mapLocationId: number,
	isDistantExpedition?: boolean
): string {
	const expeditionName = i18n.t(`commands:petExpedition.mapLocationExpeditions.${mapLocationId}`, { lng });
	if (isDistantExpedition) {
		return i18n.t("commands:petExpedition.distantExpeditionPrefix", {
			lng,
			location: expeditionName
		});
	}
	return expeditionName;
}

/**
 * Get pet display string with icon and name
 */
export function getPetDisplayString(pet: PetBasicInfo, lng: Language): string {
	return `${DisplayUtils.getPetIcon(pet.petTypeId, pet.petSex)} **${DisplayUtils.getPetNicknameOrTypeName(pet.petNickname ?? null, pet.petTypeId, pet.petSex, lng)}**`;
}

/**
 * Get location display string with emoji and name
 */
export function getLocationDisplayString(
	locationType: ExpeditionLocationType,
	mapLocationId: number,
	lng: Language,
	isDistantExpedition?: boolean
): string {
	const locationEmoji = CrowniclesIcons.expedition.locations[locationType];
	const locationName = getExpeditionLocationName(lng, mapLocationId, isDistantExpedition);
	return `${locationEmoji} ${locationName}`;
}

/**
 * Parameters for building in-progress expedition description
 */
export interface InProgressDescriptionParams {
	lng: Language;
	petDisplay: string;
	locationEmoji: string;
	locationName: string;
	riskRate: number;
	returnTime: Date;
	sexContext: string;
	foodConsumed?: number;
}

/**
 * Build the description text for an expedition in progress
 */
export function buildInProgressDescription(params: InProgressDescriptionParams): string {
	const {
		lng, petDisplay, locationEmoji, locationName, riskRate, returnTime, sexContext, foodConsumed
	} = params;

	const foodInfo = foodConsumed && foodConsumed > 0
		? i18n.t("commands:petExpedition.inProgressFoodInfo", {
			lng, count: foodConsumed
		})
		: "";

	const intro = i18n.t("commands:petExpedition.inProgressDescription.intro", {
		lng, petDisplay
	});
	const destination = i18n.t("commands:petExpedition.inProgressDescription.destination", {
		lng,
		location: `${locationEmoji} ${locationName}`
	});
	const risk = i18n.t("commands:petExpedition.inProgressDescription.risk", {
		lng,
		risk: getTranslatedRiskCategoryName(riskRate, lng),
		riskEmoji: getRiskEmoji(riskRate)
	});
	const returnTimeText = i18n.t("commands:petExpedition.inProgressDescription.returnTime", {
		lng,
		returnTime: finishInTimeDisplay(returnTime)
	});
	const warning = i18n.t("commands:petExpedition.inProgressDescription.warning", {
		lng, context: sexContext
	});

	return `${intro}\n\n${destination}\n${risk}\n${returnTimeText}${foodInfo}\n\n${warning}`;
}

/**
 * Get food consumption description
 */
export function getFoodConsumedDescription(packet: CommandPetExpeditionChoicePacketRes, lng: Language): string {
	if (packet.foodConsumedDetails && packet.foodConsumedDetails.length > 0) {
		const foodDetailsDisplay = formatFoodConsumedDetails(packet.foodConsumedDetails, lng);
		return i18n.t("commands:petExpedition.foodConsumedDetails", {
			lng,
			foodDetails: foodDetailsDisplay
		});
	}
	if (packet.foodConsumed && packet.foodConsumed > 0) {
		return i18n.t("commands:petExpedition.foodConsumed", {
			lng,
			count: packet.foodConsumed
		});
	}
	return "";
}

/**
 * Get speed category based on actual final duration vs displayed duration
 * @param actualDurationMinutes - The real duration after speed modifier
 * @param displayedDurationMinutes - The duration shown to the user (rounded to 10 min)
 */
export function getSpeedCategory(actualDurationMinutes: number, displayedDurationMinutes: number): SpeedCategory {
	// Calculate ratio: how much faster/slower compared to what was displayed
	const ratio = actualDurationMinutes / displayedDurationMinutes;

	if (ratio < 0.70) {
		return ExpeditionConstants.SPEED_CATEGORIES.VERY_FAST;
	}
	if (ratio < 0.90) {
		return ExpeditionConstants.SPEED_CATEGORIES.FAST;
	}

	/*
	 * If actual duration is close to or above displayed duration, it's "normal" (no message)
	 * Since displayed duration is already rounded up, being at or below it is expected
	 */
	if (ratio <= 1.0) {
		return ExpeditionConstants.SPEED_CATEGORIES.NORMAL;
	}
	if (ratio <= 1.15) {
		return ExpeditionConstants.SPEED_CATEGORIES.SLOW;
	}
	return ExpeditionConstants.SPEED_CATEGORIES.VERY_SLOW;
}

/**
 * Build expedition option description text for a single expedition
 */
export function buildExpeditionOptionText(
	exp: ExpeditionOptionLike,
	index: number,
	lng: Language
): string {
	const locationEmoji = CrowniclesIcons.expedition.locations[exp.locationType];
	const locationName = getExpeditionLocationName(lng, exp.mapLocationId, exp.isDistantExpedition);
	const displayDuration = i18n.formatDuration(exp.displayDurationMinutes, lng);
	const foodCost = exp.foodCost ?? 1;
	const foodDisplay = i18n.t("commands:petExpedition.foodCost", {
		lng, count: foodCost
	});

	// Build option text using nested translations
	const header = i18n.t("commands:petExpedition.expeditionOption.header", {
		lng,
		number: index + 1,
		location: `${locationEmoji} **${locationName}**`
	});
	const duration = i18n.t("commands:petExpedition.expeditionOption.duration", {
		lng,
		duration: displayDuration
	});
	const terrain = i18n.t("commands:petExpedition.expeditionOption.terrain", {
		lng,
		terrainEmoji: getTerrainEmoji(exp.difficulty),
		terrain: getTranslatedTerrainCategoryName(exp.difficulty, lng)
	});
	const risk = i18n.t("commands:petExpedition.expeditionOption.risk", {
		lng,
		riskEmoji: getRiskEmoji(exp.riskRate),
		risk: getTranslatedRiskCategoryName(exp.riskRate, lng)
	});
	const reward = i18n.t("commands:petExpedition.expeditionOption.reward", {
		lng,
		reward: getTranslatedRewardCategoryName(exp.rewardIndex, lng)
	});
	const food = i18n.t("commands:petExpedition.expeditionOption.food", {
		lng,
		foodDisplay
	});

	// Order: header, duration, risk (main factor), terrain, reward, food
	let optionText = `\n\n${header}\n${duration}\n${risk}\n${terrain}\n${reward}\n${food}`;

	// Add clone talisman bonus tag if present
	if (exp.hasCloneTalismanBonus) {
		optionText += `\n${i18n.t("commands:petExpedition.expeditionOption.cloneTalismanBonus", { lng })}`;
	}

	// Add bonus tokens tag if present
	if (exp.hasBonusTokens) {
		optionText += `\n${i18n.t("commands:petExpedition.expeditionOption.bonusTokens", { lng })}`;
	}

	return optionText;
}
