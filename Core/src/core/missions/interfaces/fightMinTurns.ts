import { IMission } from "../IMission";
import { MissionDifficulty } from "../MissionDifficulty";

const TURN_TARGETS = {
	[MissionDifficulty.EASY]: 20,
	[MissionDifficulty.MEDIUM]: 26,
	[MissionDifficulty.HARD]: 30
} as const;

export const missionInterface: IMission = {
	areParamsMatchingVariantAndBlob: (variant, params) => (params.turnCount as number) >= variant,

	generateRandomVariant: difficulty => TURN_TARGETS[difficulty] ?? TURN_TARGETS[MissionDifficulty.EASY],

	initialNumberDone: () => 0,

	updateSaveBlob: () => null
};
