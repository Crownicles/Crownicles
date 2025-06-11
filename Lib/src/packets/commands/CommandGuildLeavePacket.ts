import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildLeavePacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildLeaveRefusePacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildLeaveAcceptPacketRes extends CrowniclesPacket {
	newChiefKeycloakId?: string;

	guildName!: string;

	isGuildDestroyed?: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildLeaveNotInAGuildPacketRes extends CrowniclesPacket {
}
