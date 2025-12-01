import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { ItemWithDetails } from "../../types/ItemWithDetails";

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
	item!: ItemWithDetails;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDepositCancelPacket extends CrowniclesPacket {
}
