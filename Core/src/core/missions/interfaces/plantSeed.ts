import { IMission } from "../IMission";
import { Homes } from "../../database/game/models/Home";
import { HomeGardenSlots } from "../../database/game/models/HomeGardenSlot";

async function hasPlantedSeed(playerId: number): Promise<boolean> {
	const home = await Homes.getOfPlayer(playerId);
	if (!home) {
		return false;
	}

	const gardenSlots = await HomeGardenSlots.getOfHome(home.id);
	return gardenSlots.some(slot => !slot.isEmpty());
}

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: () => true,

	initialNumberDone: async player => await hasPlantedSeed(player.id) ? 1 : 0,

	updateSaveBlob: () => null
};
