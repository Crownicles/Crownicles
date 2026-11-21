import InventorySlot from "../../../src/core/database/game/models/InventorySlot";
import { Player } from "../../../src/core/database/game/models/Player";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { ZERO_STATS } from "../../../../Lib/src/types/StatValues";

/**
 * Inventory slot of the player as loaded from the database, with real item data behind its item id
 */
export function makeInventorySlot(slot: {
	slot: number;
	itemCategory: ItemCategory;
	itemId: number;
	itemLevel?: number | null;
	itemEnchantmentId?: string | null;
}): InventorySlot {
	return Object.assign(Object.create(InventorySlot.prototype) as InventorySlot, {
		itemLevel: 0,
		itemEnchantmentId: null,
		remainingPotionUsages: null,
		...slot
	});
}

/**
 * Player opening a city menu, with the given money and level
 */
export function makeCityPlayer(money: number, level = 1): Player {
	const player = Object.assign(Object.create(Player.prototype) as Player, {
		id: 1,
		keycloakId: "city-player",
		money,
		level
	});
	player.getMaxStatsValue = (): typeof ZERO_STATS => ZERO_STATS;
	return player;
}
