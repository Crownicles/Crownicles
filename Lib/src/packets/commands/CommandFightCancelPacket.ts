import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandFightCancelPacketReq extends CrowniclesPacket {
	fightId!: string;
}
