import { IMission } from "../IMission";
import { MissionDifficulty } from "../MissionDifficulty";

export const missionInterface: IMission = {
	/**
	 * Check if the expedition duration is greater than or equal to the variant
	 * The variant represents the minimum duration in minutes
	 */
	areParamsMatchingVariantAndBlob: (variant, params) => (params.durationMinutes as number) >= variant,

	/**
	 * Generate a random duration variant based on difficulty
	 * Easy: 45 minutes
	 * Medium: 180 minutes (3 hours)
	 * Hard: 420 minutes (7 hours)
	 */
	generateRandomVariant: difficulty => {
		switch (difficulty) {
			case MissionDifficulty.MEDIUM:
				return 180; // 3 hours
			case MissionDifficulty.HARD:
				return 420; // 7 hours
			default:
				return 45; // 45 minutes
		}
	},

	initialNumberDone: () => 0,

	updateSaveBlob: () => null
};
