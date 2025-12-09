import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SmallEventPacket } from "./SmallEventPacket";

export enum SmallEventBadIssue {
	HEALTH = "healthLost",
	MONEY = "moneyLost",
	TIME = "timeLost"
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventSmallBadPacket extends SmallEventPacket {
	amount!: number;

	issue!: SmallEventBadIssue;

	effectId?: string;
}
