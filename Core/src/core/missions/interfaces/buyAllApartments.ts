import { IMission } from "../IMission";
import { Apartments } from "../../database/game/models/Apartment";

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: () => true,

	initialNumberDone: async player => await Apartments.ownsAllApartments(player.id) ? 1 : 0,

	updateSaveBlob: () => null
};
