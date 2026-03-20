import { FightPetActionFunc } from "../../../data/FightPetAction";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";

/**
 * The player fakes one direction then attacks the other.
 * 75% base success rate.
 */
export const fightPetAction: FightPetActionFunc = (): boolean =>
	RandomUtils.crowniclesRandom.bool(SmallEventConstants.FIGHT_PET.FEINT_BASE_CHANCE);
