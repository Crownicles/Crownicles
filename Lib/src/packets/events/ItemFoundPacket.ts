import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { ItemWithDetails } from "../../types/ItemWithDetails";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class ItemFoundPacket extends CrowniclesPacket {
	itemWithDetails!: ItemWithDetails;

	/** Put straight into a free slot; otherwise a choice, a sale or a destruction follows. */
	kept!: boolean;
}
