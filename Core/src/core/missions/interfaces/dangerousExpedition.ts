import { getRiskCategoryLevel } from "../../../../../Lib/src/constants/ExpeditionConstants";
import { IMission } from "../IMission";
import { MissionDataController } from "../../../data/Mission";
import { MissionDifficulty } from "../MissionDifficulty";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

export const missionInterface: IMission = {
	/**
	 * Check if the expedition risk category is greater than or equal to the variant's category
	 * The variant represents a risk rate; categories are compared so any value in the category matches
	 */
	areParamsMatchingVariantAndBlob: (variant, params) =>
		getRiskCategoryLevel(params.riskRate as number) >= getRiskCategoryLevel(variant),

	/**
	 * Generate a random risk variant based on difficulty.
	 * The chosen reward index inside the difficulty bucket maps to a risk rate:
	 * 45 (risky / moderate), 58 (dangerous / high), 72 (perilous / veryHigh), 90 (desperate)
	 */
	generateRandomVariant: difficulty => {
		const mission = MissionDataController.instance.getById("dangerousExpedition")!;
		const difficulties = mission.difficulties!;

		let indexes: number[];
		if (difficulty === MissionDifficulty.MEDIUM) {
			indexes = difficulties.medium ?? [];
		}
		else if (difficulty === MissionDifficulty.HARD) {
			indexes = difficulties.hard ?? [];
		}
		else {
			indexes = difficulties.easy ?? [];
		}

		if (indexes.length === 0) {
			return 45;
		}

		const randomIndex = indexes[RandomUtils.crowniclesRandom.integer(0, indexes.length - 1)];
		const thresholds = [
			45,
			58,
			72,
			90
		];
		return thresholds[randomIndex] ?? 45;
	},

	initialNumberDone: () => 0,

	updateSaveBlob: () => null
};
