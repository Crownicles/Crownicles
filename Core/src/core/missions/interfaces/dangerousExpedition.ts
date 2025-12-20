import { ExpeditionConstants } from "../../../../../Lib/src/constants/ExpeditionConstants";
import { IMission } from "../IMission";
import { MissionDifficulty } from "../MissionDifficulty";

/**
 * Get a numeric category level from a risk rate value
 * Higher values = more dangerous = higher category level
 */
function getRiskCategoryLevel(riskRate: number): number {
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.VERY_LOW.MAX) {
		return 0; // veryLow
	}
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.LOW.MAX) {
		return 1; // low
	}
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.MEDIUM.MAX) {
		return 2; // medium
	}
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.HIGH.MAX) {
		return 3; // high
	}
	return 4; // veryHigh
}

export const missionInterface: IMission = {
	/**
	 * Check if the expedition risk category is greater than or equal to the variant's category
	 * The variant represents the maximum value of a risk category (e.g., 30 for "low")
	 * Compares categories instead of raw values so any value in the category matches
	 */
	areParamsMatchingVariantAndBlob: (variant, params) =>
		getRiskCategoryLevel(params.riskRate as number) >= getRiskCategoryLevel(variant),

	/**
	 * Generate a random risk variant based on difficulty
	 * Easy: 30 (moderate risk)
	 * Medium: 50 (challenging risk)
	 * Hard: 70 (treacherous risk)
	 */
	generateRandomVariant: difficulty => {
		switch (difficulty) {
			case MissionDifficulty.MEDIUM:
				return 50;
			case MissionDifficulty.HARD:
				return 70;
			default:
				return 30;
		}
	},

	initialNumberDone: () => 0,

	updateSaveBlob: () => null
};
