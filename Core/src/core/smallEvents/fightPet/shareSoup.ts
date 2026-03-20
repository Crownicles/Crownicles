import { FightPetActionFunc } from "../../../data/FightPetAction";
import { Guilds } from "../../database/game/models/Guild";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";

/**
 * The player shares the scent of their guild's soup with the beast.
 * 90% chance if guild has ultimate food in storage, 0% otherwise.
 * The soup is not consumed — the beast is calmed by the aroma alone.
 */
export const fightPetAction: FightPetActionFunc = async (player): Promise<boolean> => {
	const guild = await Guilds.getById(player.guildId);

	if (!guild || guild.ultimateFood <= 0) {
		return false;
	}

	return RandomUtils.crowniclesRandom.bool(SmallEventConstants.FIGHT_PET.SHARE_SOUP_WITH_SOUP_CHANCE);
};
