import { IMission } from "../IMission";
import { DwarfPetsSeen } from "../../database/game/models/DwarfPetsSeen";

export const missionInterface: IMission = {
	areParamsMatchingVariantAndBlob: () => true,

	generateRandomVariant: () => 0,

	initialNumberDone: async player => (await DwarfPetsSeen.getPetsSeenId(player)).length,

	updateSaveBlob: () => null
};
