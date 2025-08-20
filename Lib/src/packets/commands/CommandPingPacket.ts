import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPingPacketReq extends CrowniclesPacket {
	time!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPingPacketRes extends CrowniclesPacket {
	clientTime!: number;
}
