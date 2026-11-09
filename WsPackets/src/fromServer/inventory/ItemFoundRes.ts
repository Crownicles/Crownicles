import { FromServerPacket } from "../FromServerPacket";
import { ItemWithDetails } from "../../objects/ItemWithDetails";

/** An item the character just found; when it did not fit, a choice, a sale or a destruction follows. */
export class ItemFoundRes extends FromServerPacket {
	public static readonly wireName = "ItemFoundRes";

	item!: ItemWithDetails;

	/** Put straight into a free slot of the inventory. */
	kept!: boolean;
}
