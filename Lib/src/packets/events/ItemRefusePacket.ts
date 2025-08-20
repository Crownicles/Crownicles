import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { Item } from "../../types/Item";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class ItemRefusePacket extends CrowniclesPacket {
	item!: Item;

	autoSell!: boolean;

	soldMoney!: number;
}
