import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildDescriptionAcceptPacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildDescriptionRefusePacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildDescriptionPacketReq extends CrowniclesPacket {
	description!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildDescriptionNoGuildPacket extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildDescriptionNotAnElderPacket extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildDescriptionInvalidPacket extends CrowniclesPacket {
	min!: number;

	max!: number;
}
