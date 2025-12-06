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
	 * Easy: 120-180 minutes (2-3 hours)
	 * Medium: 240-360 minutes (4-6 hours)
	 * Hard: 480-720 minutes (8-12 hours)
	 */
	generateRandomVariant: difficulty => {
		switch (difficulty) {
			case MissionDifficulty.MEDIUM:
				return 300; // 5 hours
			case MissionDifficulty.HARD:
				return 600; // 10 hours
			default:
				return 120; // 2 hours
		}
	},

	initialNumberDone: () => 0,

	updateSaveBlob: () => null
};
