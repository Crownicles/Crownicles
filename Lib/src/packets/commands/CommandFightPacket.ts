import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandFightRefusePacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandFightPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandFightNotEnoughEnergyPacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandFightOpponentsNotFoundPacket extends CrowniclesPacket {
}
