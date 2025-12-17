import { IMission } from "../IMission";
import { PetEntities } from "../../database/game/models/PetEntity";

export const missionInterface: IMission = {
	areParamsMatchingVariantAndBlob: (_variant, params) => (params.loveLevel as number) >= 5,

	generateRandomVariant: () => 0,

	initialNumberDone: async player => player.petId && (await PetEntities.getById(player.petId)).getLoveLevelNumber() >= 5 ? 1 : 0,

	updateSaveBlob: () => null
};
