import { FightPetActionFunc } from "../../../data/FightPetAction";
import { InventorySlots } from "../../database/game/models/InventorySlot";
import { ItemCategory } from "../../../../../Lib/src/constants/ItemConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

export const fightPetAction: FightPetActionFunc = async (player, pet) =>

// Succeeds if the player has an attack greater than his level times the rarity of the animal and if random > level / 100 OR if the player has the "insults" object in his inventory
	player.getCumulativeAttack(await InventorySlots.getMainSlotsItems(player.id)) >= player.level * pet.rarity && RandomUtils.crowniclesRandom.bool(1 - player.level / 100)
	|| await InventorySlots.hasItem(player.id, 83, ItemCategory.WEAPON);
