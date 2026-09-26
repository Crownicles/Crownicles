import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandFightRefusePacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandFightPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandFightResumeReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.NONE)
export class CommandFightResumeRes extends CrowniclesPacket {
	active!: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandFightNotEnoughEnergyPacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandFightOpponentsNotFoundPacket extends CrowniclesPacket {
}
