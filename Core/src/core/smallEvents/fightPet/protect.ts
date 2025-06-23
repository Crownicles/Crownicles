import { FightPetActionFunc } from "../../../data/FightPetAction";
import { InventorySlots } from "../../database/game/models/InventorySlot";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";

export const fightPetAction: FightPetActionFunc = async (player, pet) => RandomUtils.crowniclesRandom.bool(
	Math.max(
		player.getCumulativeDefense(await InventorySlots.getPlayerActiveObjects(player.id)) / SmallEventConstants.FIGHT_PET.PROTECT_DEFENSE_NEEDED * pet.rarity,
		SmallEventConstants.FIGHT_PET.MAXIMUM_STATS_BASED_ACTIONS_CHANCES
	)
);
