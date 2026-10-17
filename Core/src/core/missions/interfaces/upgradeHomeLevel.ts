import { IMission } from "../IMission";
import { Homes } from "../../database/game/models/Home";

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: (variant, params) => (params.homeLevel as number) >= variant,

	initialNumberDone: async (player, variant) => {
		const home = await Homes.getOfPlayer(player.id);
		return home && home.level >= variant ? 1 : 0;
	},

	updateSaveBlob: () => null
};
