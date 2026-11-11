import { Weapon } from "../../../../data/Weapon";
import { Armor } from "../../../../data/Armor";
import { Potion } from "../../../../data/Potion";
import { ObjectItem } from "../../../../data/ObjectItem";
import { MainItem } from "../../../../data/MainItem";

/**
 * A weapon or an armor equipped by a player
 */
export type EquippedMainItem<T extends MainItem = MainItem> = {
	item: T;
	itemLevel: number;
	itemEnchantmentId: string | null;
};

export interface PlayerActiveObjects {
	weapon: EquippedMainItem<Weapon>;
	armor: EquippedMainItem<Armor>;
	potion: {
		item: Potion;
	};
	object: {
		item: ObjectItem;
	};
}

export type EquippedMainItemSlot = keyof Pick<PlayerActiveObjects, "weapon" | "armor">;
