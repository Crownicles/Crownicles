import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandRespawnPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandRespawnPacketRes extends CrowniclesPacket {
	lostScore!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandRespawnErrorAlreadyAlive extends CrowniclesPacket {
}
