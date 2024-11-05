import {DraftBotPacket, PacketDirection, sendablePacket} from "../DraftBotPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class PlayerLeavePveIslandPacket extends DraftBotPacket {
	moneyLost!: number;

	guildPointsLost!: number;
}