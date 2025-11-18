import { FightPetActionFunc } from "../../../data/FightPetAction";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { PetUtils } from "../../utils/PetUtils";

export const fightPetAction: FightPetActionFunc = (player, pet) =>

	// Chances of success are based on the level of the player and the vigor of the enraged pet
	RandomUtils.crowniclesRandom.bool(
		Math.max(Math.min(SmallEventConstants.FIGHT_PET.INTIMIDATE_MAXIMUM_LEVEL, player.level)
			- PetUtils.getPetVigor(pet, 0, { enraged: true }) * SmallEventConstants.FIGHT_PET.INTIMIDATE_RARITY_MULTIPLIER, 0) / 100
	);
