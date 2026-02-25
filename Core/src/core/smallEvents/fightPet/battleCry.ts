import { FightPetActionFunc } from "../../../data/FightPetAction";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";
import { PetUtils } from "../../utils/PetUtils";
import { PetConstants } from "../../../../../Lib/src/constants/PetConstants";

/**
 * The player lets out a powerful battle cry.
 * 75% base chance. If the player has a pet that can join the noise, +10%.
 */
export const fightPetAction: FightPetActionFunc = async (player): Promise<boolean> => {
	const hasPet = await PetUtils.isPetAvailable(player, PetConstants.AVAILABILITY_CONTEXT.SMALL_EVENT);
	const petBonus = hasPet ? SmallEventConstants.FIGHT_PET.BATTLE_CRY_PET_BONUS : 0;

	return RandomUtils.crowniclesRandom.bool(
		SmallEventConstants.FIGHT_PET.BATTLE_CRY_BASE_CHANCE + petBonus
	);
};
