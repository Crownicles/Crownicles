import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildElderAcceptPacketRes extends CrowniclesPacket {
	promotedKeycloakId!: string;

	guildName!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildElderRefusePacketRes extends CrowniclesPacket {
	promotedKeycloakId!: string;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildElderPacketReq extends CrowniclesPacket {
	askedPlayerKeycloakId!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildElderSameGuildPacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildElderHimselfPacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildElderAlreadyElderPacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildElderFoundPlayerPacketRes extends CrowniclesPacket {
}
