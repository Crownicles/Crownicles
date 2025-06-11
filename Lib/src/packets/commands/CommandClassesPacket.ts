import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandClassesPacketReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandClassesCooldownErrorPacket extends CrowniclesPacket {
	timestamp!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandClassesCancelErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandClassesChangeSuccessPacket extends CrowniclesPacket {
	classId!: number;
}
