import { IMission } from "../IMission";
import { ItemConstants } from "../../../../../Lib/src/constants/ItemConstants";

const REQUIRED_LEVEL = 5;

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: (_variant, params) =>
		(params.rarity as number) >= ItemConstants.RARITY.EPIC && (params.newLevel as number) >= REQUIRED_LEVEL,

	initialNumberDone: () => 0,

	updateSaveBlob: () => null
};
