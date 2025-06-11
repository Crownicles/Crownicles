import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { Item } from "../../types/Item";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandSellPacketReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandSellNoItemErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandSellCancelErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandSellItemSuccessPacket extends CrowniclesPacket {
	item!: Item;

	price!: number;
}
