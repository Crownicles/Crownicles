import { IMission } from "../IMission";
import { MissionDifficulty } from "../MissionDifficulty";

export const missionInterface: IMission = {
	/**
	 * Check if the expedition risk rate is greater than or equal to the variant
	 * The variant represents the minimum risk rate (0-100)
	 */
	areParamsMatchingVariantAndBlob: (variant, params) => (params.riskRate as number) >= variant,

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
