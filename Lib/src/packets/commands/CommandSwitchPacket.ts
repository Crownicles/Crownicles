import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { ItemWithDetails } from "../../types/ItemWithDetails";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandSwitchPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandSwitchSuccess extends CrowniclesPacket {
	itemBackedUp!: ItemWithDetails;

	itemEquipped!: ItemWithDetails;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandSwitchErrorNoItemToSwitch extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandSwitchCancelled extends CrowniclesPacket {
}
