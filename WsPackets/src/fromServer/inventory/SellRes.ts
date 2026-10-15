import { FromServerPacket } from "../FromServerPacket";
import { Item } from "../../objects/Item";

export class SellRes extends FromServerPacket {
	public static readonly wireName = "SellRes";

	item!: Item;

	price!: number;
}

export class SellNoItemRes extends FromServerPacket {
	public static readonly wireName = "SellNoItemRes";
}

export class SellCancelRes extends FromServerPacket {
	public static readonly wireName = "SellCancelRes";
}
