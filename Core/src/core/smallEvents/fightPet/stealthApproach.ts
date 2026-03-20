import { FightPetActionFunc } from "../../../data/FightPetAction";
import { InventorySlots } from "../../database/game/models/InventorySlot";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";
import { PetUtils } from "../../utils/PetUtils";
import { ClassInfoConstants } from "../../../../../Lib/src/constants/ClassInfoConstants";

/**
 * The player attempts a stealthy approach to the pet.
 * Based on speed with a bonus for attack classes (naturally more agile).
 * Different from runAway: offensive use of speed rather than defensive.
 */
export const fightPetAction: FightPetActionFunc = async (player, pet): Promise<boolean> => {
	const speedBonus = ClassInfoConstants.STEALTHY_CLASSES.includes(player.class)
		? SmallEventConstants.FIGHT_PET.STEALTH_CLASS_BONUS
		: 0;

	return RandomUtils.crowniclesRandom.bool(
		Math.min(
			player.getCumulativeSpeed(await InventorySlots.getPlayerActiveObjects(player.id))
			/ SmallEventConstants.FIGHT_PET.STEALTH_SPEED_THRESHOLD
			/ PetUtils.getPetVigor(pet, 0, { enraged: true })
			+ speedBonus,
			SmallEventConstants.FIGHT_PET.STEALTH_MAX_CHANCE
		)
	);
};
