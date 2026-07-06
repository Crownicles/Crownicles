import { IMission } from "../IMission";
import { PlantId } from "../../../../../Lib/src/constants/PlantConstants";
import { Homes } from "../../database/game/models/Home";
import { PlayerPlantSlots } from "../../database/game/models/PlayerPlantSlot";
import { HomePlantStorages } from "../../database/game/models/HomePlantStorage";

/**
 * Check whether the player already holds a harvested or bought ancestral tree plant
 * (not a seed, and not a tree still growing in the garden), either in their plant
 * inventory or in their home plant storage (chest).
 */
async function ownsAncestralTreePlant(playerId: number): Promise<boolean> {
	if (await PlayerPlantSlots.hasPlantInPlantSlots(playerId, PlantId.ANCIENT_TREE)) {
		return true;
	}

	const home = await Homes.getOfPlayer(playerId);
	if (!home) {
		return false;
	}

	const storage = await HomePlantStorages.getForPlant(home.id, PlantId.ANCIENT_TREE);
	return storage !== null && storage.quantity > 0;
}

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: () => true,

	initialNumberDone: async player => await ownsAncestralTreePlant(player.id) ? 1 : 0,

	updateSaveBlob: () => null
};
