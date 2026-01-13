import { getRiskCategoryLevel } from "../../../../../Lib/src/constants/ExpeditionConstants";
import { IMission } from "../IMission";
import { MissionDifficulty } from "../MissionDifficulty";

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
