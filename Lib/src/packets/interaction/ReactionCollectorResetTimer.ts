import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class ReactionCollectorResetTimerPacketReq extends CrowniclesPacket {
	reactionCollectorId!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class ReactionCollectorResetTimerPacketRes extends CrowniclesPacket {
	reactionCollectorId!: string;

	endTime!: number;
}
