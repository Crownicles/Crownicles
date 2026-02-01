import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventGoToPVEIslandNotEnoughGemsPacket extends SmallEventPacket {

}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventGoToPVEIslandAcceptPacket extends SmallEventPacket {
	alone!: boolean;

	pointsWon!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventGoToPVEIslandRefusePacket extends SmallEventPacket {

}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventGoToPVEIslandNoAnswerPacket extends SmallEventPacket {

}
