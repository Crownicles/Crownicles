import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { ItemWithDetails } from "../../types/ItemWithDetails";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class ItemFoundPacket extends CrowniclesPacket {
	itemWithDetails!: ItemWithDetails;
}
