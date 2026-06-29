import { IMission } from "../IMission";
import { Apartments } from "../../database/game/models/Apartment";
import { CityDataController } from "../../../data/City";

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: () => true,

	initialNumberDone: async player => {
		const total = CityDataController.instance.countApartmentCities();
		const owned = (await Apartments.getOfPlayer(player.id)).length;
		return total > 0 && owned >= total ? 1 : 0;
	},

	updateSaveBlob: () => null
};
