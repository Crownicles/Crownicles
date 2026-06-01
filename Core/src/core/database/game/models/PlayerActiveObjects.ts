import { Weapon } from "../../../../data/Weapon";
import { Armor } from "../../../../data/Armor";
import { Potion } from "../../../../data/Potion";
import { ObjectItem } from "../../../../data/ObjectItem";

export interface PlayerActiveObjects {
	weapon: {
		item: Weapon;
		itemLevel: number;
		itemEnchantmentId: string | null;
	};
	armor: {
		item: Armor;
		itemLevel: number;
		itemEnchantmentId: string | null;
	};
	potion: {
		item: Potion;
	};
	object: {
		item: ObjectItem;
	};
}
