import { FightPetActionFunc } from "../../../data/FightPetAction";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";
import { InventorySlots } from "../../database/game/models/InventorySlot";
import { ItemConstants } from "../../../../../Lib/src/constants/ItemConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

export const fightPetAction: FightPetActionFunc = async (player, pet) =>

	// This action has 10% times how many holy items the player has times the rarity of the pet
	RandomUtils.crowniclesRandom.bool(SmallEventConstants.FIGHT_PET.PRAYER_CHANCE * pet.rarity
		* await InventorySlots.countObjectsOfPlayer(player.id, ItemConstants.TAGS.HOLY)
		+ SmallEventConstants.FIGHT_PET.HAS_AN_HOLY_ATTACK_CHANCE * (player.hasHolyClass() ? 1 : 0));
