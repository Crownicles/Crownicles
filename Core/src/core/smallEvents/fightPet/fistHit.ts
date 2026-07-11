import { FightPetActionFunc } from "../../../data/FightPetAction";
import { InventorySlots } from "../../database/game/models/InventorySlot";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";
import { PetUtils } from "../../utils/PetUtils";

export const fightPetAction: FightPetActionFunc = async (player, pet) => {
	// isPvE: true - fighting a pet is not a player-versus-player encounter
	const attack = player.getCumulativeAttack(await InventorySlots.getPlayerActiveObjects(player.id), true);

	return RandomUtils.crowniclesRandom.bool(
		Math.max(
			attack / (SmallEventConstants.FIGHT_PET.FIST_HIT_ATTACK_NEEDED * PetUtils.getPetVigor(pet, 0, { enraged: true })),
			SmallEventConstants.FIGHT_PET.MAXIMUM_STATS_BASED_ACTIONS_CHANCES
		)
	);
};
