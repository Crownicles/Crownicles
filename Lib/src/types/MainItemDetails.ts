import { ItemRarity } from "../constants/ItemConstants";

export interface MainItemDetails {
	id: number;
	rarity: ItemRarity;
	itemCategory: number;
	itemLevel: number;
	itemEnchantmentId?: string;
	attack: {
		baseValue: number;
		upgradeValue: number;
		maxValue: number;
	};
	defense: {
		baseValue: number;
		upgradeValue: number;
		maxValue: number;
	};
	speed: {
		baseValue: number;
		upgradeValue: number;
		maxValue: number;
	};
}
