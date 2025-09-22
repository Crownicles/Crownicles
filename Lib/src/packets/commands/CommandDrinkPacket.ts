import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { ItemNature } from "../../constants/ItemConstants";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandDrinkPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDrinkCancelDrink extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDrinkPacketRes extends CrowniclesPacket {
	value!: number;

	itemNature!: ItemNature;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDrinkNoAvailablePotion extends CrowniclesPacket {}
