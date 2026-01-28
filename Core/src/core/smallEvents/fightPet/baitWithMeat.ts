import { FightPetActionFunc } from "../../../data/FightPetAction";
import { Guilds } from "../../database/game/models/Guild";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

export const fightPetAction: FightPetActionFunc = async (player, pet) => {
	const guild = await Guilds.getById(player.guildId);
	return !!(guild && pet.canEatMeat() && RandomUtils.crowniclesRandom.bool() && guild.carnivorousFood > 0);
};
