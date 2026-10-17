import { IMission } from "../IMission";
import { MissionDifficulty } from "../MissionDifficulty";
import { MaterialRarity } from "../../../../../Lib/src/types/MaterialRarity";

export const missionInterface: IMission = {
	/**
	 * The variant represents the minimum material rarity that counts for the mission
	 * Easy: common, Medium: uncommon, Hard: rare
	 */
	generateRandomVariant: difficulty => {
		switch (difficulty) {
			case MissionDifficulty.MEDIUM:
				return MaterialRarity.UNCOMMON;
			case MissionDifficulty.HARD:
				return MaterialRarity.RARE;
			default:
				return MaterialRarity.COMMON;
		}
	},

	areParamsMatchingVariantAndBlob: (variant, params) => (params.rarity as number) >= variant,

	initialNumberDone: () => 0,

	updateSaveBlob: () => null
};
