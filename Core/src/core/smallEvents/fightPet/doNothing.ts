import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { FightPetActionFunc } from "../../../data/FightPetAction";

/**
 * The player does nothing and hopes for the best
 */

export const fightPetAction: FightPetActionFunc = (): boolean => RandomUtils.crowniclesRandom.bool(SmallEventConstants.FIGHT_PET.DO_NOTHING_VERY_LUCKY_THRESHOLD);
