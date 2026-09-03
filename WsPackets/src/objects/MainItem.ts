import { ItemRarity } from "./ItemRarity";
import { MainItemStat } from "./MainItemStat";

export type MainItem = {
	id: number;
	rarity: ItemRarity;
	itemCategory: number;
	itemLevel: number;
	itemEnchantmentId?: string;
	attack: MainItemStat;
	defense: MainItemStat;
	speed: MainItemStat;
};
