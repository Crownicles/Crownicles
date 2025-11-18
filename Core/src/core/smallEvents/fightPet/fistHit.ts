import { FightPetActionFunc } from "../../../data/FightPetAction";
import { InventorySlots } from "../../database/game/models/InventorySlot";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";
import { PetUtils } from "../../utils/PetUtils";

export const fightPetAction: FightPetActionFunc = async (player, pet) => RandomUtils.crowniclesRandom.bool(
	Math.max(
		player.getCumulativeAttack(await InventorySlots.getPlayerActiveObjects(player.id)) / SmallEventConstants.FIGHT_PET.FIST_HIT_ATTACK_NEEDED * PetUtils.getPetVigor(pet, 0, { enraged: true }),
		SmallEventConstants.FIGHT_PET.MAXIMUM_STATS_BASED_ACTIONS_CHANCES
	)
);
