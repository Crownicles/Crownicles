import { IMission } from "../IMission";

export const missionInterface: IMission = {
	areParamsMatchingVariantAndBlob: () => true,

	generateRandomVariant: () => 0,

	initialNumberDone: player => player.petId ? 1 : 0,

	updateSaveBlob: () => null
};
