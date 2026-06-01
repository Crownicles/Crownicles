import { ItemCategory } from "../constants/ItemConstants";
import { ItemWithDetails } from "./ItemWithDetails";

export type ItemSlot = {
	slot: number;
	category: ItemCategory;
	details: ItemWithDetails;
};
