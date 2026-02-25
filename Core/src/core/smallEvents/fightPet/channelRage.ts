import { FightPetActionFunc } from "../../../data/FightPetAction";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";

/**
 * The player channels their accumulated rage to fight the pet.
 * Higher rage = higher success chance, capped at 80%.
 */
export const fightPetAction: FightPetActionFunc = (player): boolean =>
	RandomUtils.crowniclesRandom.bool(
		Math.min(
			player.rage * SmallEventConstants.FIGHT_PET.CHANNEL_RAGE_MULTIPLIER,
			SmallEventConstants.FIGHT_PET.CHANNEL_RAGE_MAX_CHANCE
		)
	);
