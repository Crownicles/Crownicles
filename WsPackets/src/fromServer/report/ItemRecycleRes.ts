import { FromServerPacket } from "../FromServerPacket";

/** A reserve weapon or armor dismantled by the scrap dealer, and what it gave back. */
export class ItemRecycleRes extends FromServerPacket {
	public static readonly wireName = "ItemRecycleRes";

	itemId!: number;

	itemCategory!: number;

	itemLevel!: number;

	materials!: {
		materialId: number; quantity: number;
	}[];

	moneyGained!: number;
}
