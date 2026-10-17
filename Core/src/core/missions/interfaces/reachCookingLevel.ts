import { IMission } from "../IMission";

export const missionInterface: IMission = {
	areParamsMatchingVariantAndBlob: () => true,

	generateRandomVariant: () => 0,

	initialNumberDone: player => player.cookingLevel,

	updateSaveBlob: () => null
};
