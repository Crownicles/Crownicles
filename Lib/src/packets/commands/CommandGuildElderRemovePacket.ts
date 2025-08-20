import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildElderRemoveAcceptPacketRes extends CrowniclesPacket {
	demotedKeycloakId!: string;

	guildName!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildElderRemoveRefusePacketRes extends CrowniclesPacket {
	demotedKeycloakId!: string;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildElderRemovePacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildElderRemoveNoElderPacket extends CrowniclesPacket {
}
