import { IMission } from "../IMission";
import { Apartments } from "../../database/game/models/Apartment";
import { CityDataController } from "../../../data/City";

/**
 * Count the total number of apartments a player can buy across all cities
 * (one apartment per city that has an apartment price configured).
 */
function countPurchasableApartments(): number {
	return CityDataController.instance.getAllValues()
		.filter(city => city.apartmentPrice)
		.length;
}

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: () => true,

	initialNumberDone: async player => {
		const total = countPurchasableApartments();
		const owned = (await Apartments.getOfPlayer(player.id)).length;
		return total > 0 && owned >= total ? 1 : 0;
	},

	updateSaveBlob: () => null
};
