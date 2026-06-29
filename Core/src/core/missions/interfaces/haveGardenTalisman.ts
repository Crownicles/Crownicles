import { IMission } from "../IMission";
import { PlayerTalismansManager } from "../../database/game/models/PlayerTalismans";

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: () => true,

	initialNumberDone: async player => (await PlayerTalismansManager.getOfPlayer(player.id)).hasRemoteHarvestTalisman ? 1 : 0,

	updateSaveBlob: () => null
};
