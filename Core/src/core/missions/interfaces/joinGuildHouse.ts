import { IMission } from "../IMission";
import { Guilds } from "../../database/game/models/Guild";

export const missionInterface: IMission = {
	generateRandomVariant: () => 0,

	areParamsMatchingVariantAndBlob: () => true,

	initialNumberDone: async player => {
		if (!player.guildId) {
			return 0;
		}
		const guild = await Guilds.getById(player.guildId);
		return guild && guild.domainCityId !== null ? 1 : 0;
	},

	updateSaveBlob: () => null
};
