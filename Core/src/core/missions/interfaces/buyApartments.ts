import { IMission } from "../IMission";
import { Apartments } from "../../database/game/models/Apartment";

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: () => true,

	initialNumberDone: async player => (await Apartments.getOfPlayer(player.id)).length,

	updateSaveBlob: () => null
};
