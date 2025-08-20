import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import {
	MainItemDisplayPacket, SupportItemDisplayPacket
} from "./CommandInventoryPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandSwitchPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandSwitchSuccess extends CrowniclesPacket {
	itemBackedUp!: MainItemDisplayPacket | SupportItemDisplayPacket;

	itemEquipped!: MainItemDisplayPacket | SupportItemDisplayPacket;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandSwitchErrorNoItemToSwitch extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandSwitchCancelled extends CrowniclesPacket {
}
