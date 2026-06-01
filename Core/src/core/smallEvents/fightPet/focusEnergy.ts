import { FightPetActionFunc } from "../../../data/FightPetAction";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";
import { PetUtils } from "../../utils/PetUtils";

export const fightPetAction: FightPetActionFunc = (player, pet, _isFemale, playerActiveObjects) =>

	// Chances of success is the ratio of remaining energy on total energy minus the vigor of the pet
	RandomUtils.crowniclesRandom.bool(
		player.getRatioCumulativeEnergy(playerActiveObjects)
		- PetUtils.getPetVigor(pet, 0, { enraged: true }) * SmallEventConstants.FIGHT_PET.ENERGY_BASED_ACTIONS_RARITY_MULTIPLIER
	);
