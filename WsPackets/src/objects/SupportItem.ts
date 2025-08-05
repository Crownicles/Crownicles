import { ItemNature } from "./ItemNature";

export type SupportItem = {
	id: number;
	rarity: number;
	nature: ItemNature;
	power: number;
	maxPower: number;
	itemCategory: number;
};
