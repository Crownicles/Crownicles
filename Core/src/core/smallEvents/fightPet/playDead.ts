import { FightPetActionFunc } from "../../../data/FightPetAction";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

export const fightPetAction: FightPetActionFunc = player => RandomUtils.crowniclesRandom.bool(1 - player.health / player.getMaxHealth());
