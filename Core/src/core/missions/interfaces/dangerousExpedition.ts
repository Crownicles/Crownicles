import { ExpeditionConstants } from "../../../../../Lib/src/constants/ExpeditionConstants";
import { IMission } from "../IMission";
import { MissionDifficulty } from "../MissionDifficulty";

/**
 * Get a numeric category level from a risk rate value
 * Higher values = more dangerous = higher category level
 * 8 categories: trivial(0), veryLow(1), low(2), moderate(3), high(4), veryHigh(5), extreme(6), desperate(7)
 */
function getRiskCategoryLevel(riskRate: number): number {
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.TRIVIAL.MAX) {
		return 0; // trivial
	}
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.VERY_LOW.MAX) {
		return 1; // veryLow
	}
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.LOW.MAX) {
		return 2; // low
	}
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.MODERATE.MAX) {
		return 3; // moderate
	}
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.HIGH.MAX) {
		return 4; // high
	}
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.VERY_HIGH.MAX) {
		return 5; // veryHigh
	}
	if (riskRate <= ExpeditionConstants.RISK_DISPLAY_CATEGORIES.EXTREME.MAX) {
		return 6; // extreme
	}
	return 7; // desperate
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
	 * Easy: 45 (moderate risk)
	 * Medium: 58 (high risk)
	 * Hard: 72 (veryHigh risk)
	 */
	generateRandomVariant: difficulty => {
		switch (difficulty) {
			case MissionDifficulty.MEDIUM:
				return 58;
			case MissionDifficulty.HARD:
				return 72;
			default:
				return 45;
		}
	},

	initialNumberDone: () => 0,

	updateSaveBlob: () => null
};
