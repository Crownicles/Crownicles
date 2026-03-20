import { FightPetActionFunc } from "../../../data/FightPetAction";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";
import { InventorySlots } from "../../database/game/models/InventorySlot";
import { ItemConstants } from "../../../../../Lib/src/constants/ItemConstants";
import { ClassInfoConstants } from "../../../../../Lib/src/constants/ClassInfoConstants";

/**
 * The player throws a rock far away to distract the beast.
 * 40% base + 30% if equipped with a ranged weapon + 30% if gunner class.
 */
export const fightPetAction: FightPetActionFunc = async (player): Promise<boolean> => {
	const hasRangedWeapon = await InventorySlots.countObjectsOfPlayer(player.id, ItemConstants.TAGS.RANGED) > 0;
	const isGunnerClass = ClassInfoConstants.GUNNER_CLASSES.includes(player.class);

	const chance = SmallEventConstants.FIGHT_PET.THROW_ROCK_BASE_CHANCE
		+ (hasRangedWeapon ? SmallEventConstants.FIGHT_PET.THROW_ROCK_RANGED_BONUS : 0)
		+ (isGunnerClass ? SmallEventConstants.FIGHT_PET.THROW_ROCK_GUNNER_BONUS : 0);

	return RandomUtils.crowniclesRandom.bool(chance);
};
