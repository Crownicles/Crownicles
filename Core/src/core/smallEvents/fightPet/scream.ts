import { FightPetActionFunc } from "../../../data/FightPetAction";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

export const fightPetAction: FightPetActionFunc = (_player, _pet, isFemale) =>

// Succeeds 4/10 if the pet is masculine, 6/10 if the pet is feminine
	RandomUtils.crowniclesRandom.bool(isFemale ? 0.4 : 0.6);
