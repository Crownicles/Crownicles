import { FightPetActionFunc } from "../../../data/FightPetAction";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";
import { PetUtils } from "../../utils/PetUtils";

export const fightPetAction: FightPetActionFunc = (player, pet) =>

// Chances of success is the ratio of remaining energy on total energy minus the vigor of the pet
	RandomUtils.crowniclesRandom.bool(
		1 - player.getRatioCumulativeEnergy()
		- PetUtils.getPetVigor(pet, 0, { enraged: true }) * SmallEventConstants.FIGHT_PET.ENERGY_BASED_ACTIONS_RARITY_MULTIPLIER
	);
