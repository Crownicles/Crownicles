import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandJoinBoatPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandJoinBoatAcceptPacketRes extends CrowniclesPacket {
	score!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandJoinBoatRefusePacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandJoinBoatNoGuildPacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandJoinBoatTooManyRunsPacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandJoinBoatNoMemberOnBoatPacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandJoinBoatNotEnoughEnergyPacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandJoinBoatNotEnoughGemsPacketRes extends CrowniclesPacket {
}
