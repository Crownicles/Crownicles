import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class PlayerLeavePveIslandPacket extends CrowniclesPacket {
	moneyLost!: number;

	guildPointsLost!: number;
}
