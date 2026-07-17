import InventorySlot from "../../core/database/game/models/InventorySlot";
import { Potion } from "../../data/Potion";
import { NO_STAT_COMPARISON } from "../../../../Lib/src/types/StatValues";

export function buildPotionDisplayPacket(item: InventorySlot): ReturnType<Potion["getDisplayPacket"]> {
	return (item.getItem() as Potion).getDisplayPacket(NO_STAT_COMPARISON, item.remainingPotionUsages);
}
