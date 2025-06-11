import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { ItemWithDetails } from "../../types/ItemWithDetails";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class ItemAcceptPacket extends CrowniclesPacket {
	itemWithDetails!: ItemWithDetails;
}
