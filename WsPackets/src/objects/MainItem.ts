import { ItemRarity } from "./ItemRarity";
import { ValueAndMax } from "./ValueAndMax";

export type MainItem = {
	id: number;
	rarity: ItemRarity;
	itemCategory: number;
	attack: ValueAndMax;
	defense: ValueAndMax;
	speed: ValueAndMax;
};
