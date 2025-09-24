import { FightPetActionFunc } from "../../../data/FightPetAction";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";

export const fightPetAction: FightPetActionFunc = (player, pet, _isFemale, playerActiveObjects) =>

	// Chances of success is the ratio of remaining energy on total energy minus the rarity of the pet
	RandomUtils.crowniclesRandom.bool(
		player.getRatioCumulativeEnergy(playerActiveObjects)
		- pet.rarity * SmallEventConstants.FIGHT_PET.ENERGY_BASED_ACTIONS_RARITY_MULTIPLIER
	);
