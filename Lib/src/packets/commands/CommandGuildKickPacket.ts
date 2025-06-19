import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildKickPacketReq extends CrowniclesPacket {
	askedPlayer!: {
		rank?: number;
		keycloakId?: string;
	};
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildKickPacketRes extends CrowniclesPacket {
	foundPlayer!: boolean;

	sameGuild!: boolean;

	himself!: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildKickBlockedErrorPacket extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildKickRefusePacketRes extends CrowniclesPacket {
	kickedKeycloakId!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildKickAcceptPacketRes extends CrowniclesPacket {
	kickedKeycloakId!: string;

	guildName!: string;
}
