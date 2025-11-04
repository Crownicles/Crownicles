import { IMission } from "../IMission";
import { MissionDifficulty } from "../MissionDifficulty";

export const missionInterface: IMission = {
	areParamsMatchingVariantAndBlob: (variant, params) => (params.turnCount as number) >= variant,

	generateRandomVariant: difficulty => {
		switch (difficulty) {
			case MissionDifficulty.MEDIUM:
				return 26;
			case MissionDifficulty.HARD:
				return 30;
			default:
				return 20;
		}
	},

	initialNumberDone: () => 0,

	updateSaveBlob: () => null
};
