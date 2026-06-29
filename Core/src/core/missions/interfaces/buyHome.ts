import { IMission } from "../IMission";
import { Homes } from "../../database/game/models/Home";

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: () => true,

	initialNumberDone: async player => await Homes.getOfPlayer(player.id) ? 1 : 0,

	updateSaveBlob: () => null
};
