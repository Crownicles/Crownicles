import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildCreatePacketReq extends CrowniclesPacket {
	keycloakId!: string;

	askedGuildName!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildCreatePacketRes extends CrowniclesPacket {
	playerMoney!: number;

	foundGuild!: boolean;

	guildNameIsAvailable?: boolean;

	guildNameIsAcceptable?: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildCreateRefusePacketRes extends CrowniclesPacket {

}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildCreateAcceptPacketRes extends CrowniclesPacket {
	guildName!: string;
}
