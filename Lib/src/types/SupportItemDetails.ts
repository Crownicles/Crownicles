import { ItemNature } from "../constants/ItemConstants";

export interface SupportItemDetails {
	id: number;
	rarity: number;
	nature: ItemNature;
	power: number;
	maxPower: number;
	itemCategory: number;
}
