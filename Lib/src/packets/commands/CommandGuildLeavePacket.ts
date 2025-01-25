import {DraftBotPacket, PacketDirection, sendablePacket} from "../DraftBotPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGuildLeavePacketReq extends DraftBotPacket {
	askedPlayerKeycloakId!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildLeaveRefusePacketRes extends DraftBotPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGuildLeaveAcceptPacketRes extends DraftBotPacket {
	newChiefKeycloakId?: string;

	guildName!: string;
}