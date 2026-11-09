import { FromServerPacket } from "../FromServerPacket";
import { Item } from "../../objects/Item";

/** An item leaving the inventory after a find: sold, or destroyed when it is a potion. */
export class ItemRefusedRes extends FromServerPacket {
	public static readonly wireName = "ItemRefusedRes";

	item!: Item;

	autoSell!: boolean;

	soldMoney!: number;
}
