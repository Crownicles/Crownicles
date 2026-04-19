import { FightPetActionFunc } from "../../../data/FightPetAction";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

export const fightPetAction: FightPetActionFunc = (player, _pet, _isFemale, playerActiveObjects) =>
	RandomUtils.crowniclesRandom.bool(1 - player.getHealth(playerActiveObjects) / player.getMaxHealth(playerActiveObjects));
