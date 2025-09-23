import {
	CrowniclesPacket,
	PacketDirection,
	sendablePacket
} from "../CrowniclesPacket";
import {
	MainItemDisplayPacket,
	SupportItemDisplayPacket
} from "./CommandInventoryPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandDepositPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDepositNoItemPacket extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDepositCannotDepositPacket extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDepositSuccessPacket extends CrowniclesPacket {
	item!: MainItemDisplayPacket | SupportItemDisplayPacket;
}
