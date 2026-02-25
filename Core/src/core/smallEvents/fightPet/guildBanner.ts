import { FightPetActionFunc } from "../../../data/FightPetAction";
import { Guilds } from "../../database/game/models/Guild";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";

/**
 * The player raises their guild's banner to intimidate the pet.
 * Based on guild level — a powerful guild's banner commands more authority.
 */
export const fightPetAction: FightPetActionFunc = async (player): Promise<boolean> => {
	const guild = await Guilds.getById(player.guildId);
	if (!guild) {
		return false;
	}

	return RandomUtils.crowniclesRandom.bool(
		Math.min(guild.level, SmallEventConstants.FIGHT_PET.GUILD_BANNER_LEVEL_CAP)
		/ SmallEventConstants.FIGHT_PET.GUILD_BANNER_LEVEL_CAP
		* SmallEventConstants.FIGHT_PET.GUILD_BANNER_MAX_CHANCE
	);
};
