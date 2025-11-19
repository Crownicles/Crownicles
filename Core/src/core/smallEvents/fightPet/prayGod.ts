import { FightPetActionFunc } from "../../../data/FightPetAction";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";
import { InventorySlots } from "../../database/game/models/InventorySlot";
import { ItemConstants } from "../../../../../Lib/src/constants/ItemConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { PetUtils } from "../../utils/PetUtils";

export const fightPetAction: FightPetActionFunc = async (player, pet) =>

	// This action has 10% times how many holy items the player has times the vigor of the enraged pet
	RandomUtils.crowniclesRandom.bool(SmallEventConstants.FIGHT_PET.PRAYER_CHANCE * PetUtils.getPetVigor(pet, 0, { enraged: true })
		* await InventorySlots.countObjectsOfPlayer(player.id, ItemConstants.TAGS.HOLY)
		+ SmallEventConstants.FIGHT_PET.HAS_AN_HOLY_ATTACK_CHANCE * (player.hasHolyClass() ? 1 : 0));
