import { ItemCategory } from "../constants/ItemConstants";
import { MainItemDetails } from "./MainItemDetails";

/**
 * An enchanted weapon or armor of the player that a city service can strip of its enchantment
 */
export type DisenchantableItem = {
	slot: number;
	category: ItemCategory;
	details: MainItemDetails;
	enchantmentId: string;
	enchantmentType: string;
};
