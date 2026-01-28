import { IMission } from "../IMission";
import { MissionDataController } from "../../../data/Mission";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

export const missionInterface: IMission = {
	areParamsMatchingVariantAndBlob: (variant, params) => {
		const turnCount = Number(params.turnCount ?? 0);
		return Number.isFinite(turnCount) && turnCount >= variant;
	},

	generateRandomVariant: (difficulty, _player) => {
		const mission = MissionDataController.instance.getById("fightMinTurns")!;
		const difficulties = mission.difficulties!;

		let indexes: number[];
		if (difficulty === 0) { // EASY
			indexes = difficulties.easy ?? [];
		}
		else if (difficulty === 1) { // MEDIUM
			indexes = difficulties.medium ?? [];
		}
		else { // HARD
			indexes = difficulties.hard ?? [];
		}

		if (indexes.length === 0) {
			return 20;
		}

		const randomIndex = indexes[RandomUtils.crowniclesRandom.integer(0, indexes.length - 1)];
		const thresholds = [
			20,
			22,
			21,
			25,
			26,
			30,
			40
		];
		return thresholds[randomIndex] ?? 20;
	},

	initialNumberDone: () => 0,

	updateSaveBlob: () => null
};
