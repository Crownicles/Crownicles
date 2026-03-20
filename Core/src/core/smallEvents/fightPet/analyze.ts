import { FightPetActionFunc } from "../../../data/FightPetAction";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";

/**
 * The player analyzes the pet's weaknesses using their experience.
 * Based on player level, capped at level 120 for 70% success chance, degressive below.
 */
export const fightPetAction: FightPetActionFunc = (player): boolean =>
	RandomUtils.crowniclesRandom.bool(
		Math.min(player.level, SmallEventConstants.FIGHT_PET.ANALYZE_LEVEL_CAP)
		/ SmallEventConstants.FIGHT_PET.ANALYZE_LEVEL_CAP
		* SmallEventConstants.FIGHT_PET.ANALYZE_MAX_CHANCE
	);
