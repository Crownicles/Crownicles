import { ItemCategory } from "../constants/ItemConstants";
import { ItemWithDetails } from "./ItemWithDetails";

/**
 * Data for a single inventory category in the equip menu.
 */
export interface EquipCategoryData {
	category: ItemCategory;
	equippedItem: {
		details: ItemWithDetails;
	} | null;
	reserveItems: {
		slot: number;
		details: ItemWithDetails;
	}[];
	maxReserveSlots: number;
}
