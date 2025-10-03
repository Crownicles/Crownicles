import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SmallEventPacket } from "./SmallEventPacket";

export enum SmallEventLimogesOutcome {
	ACCEPT = "accept",
	REFUSE = "refuse"
}

export type SmallEventLimogesPenaltyType = "health" | "money" | "time";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventLimogesPacket extends SmallEventPacket {
	factKey!: string;

	outcome!: SmallEventLimogesOutcome;

	reward?: {
		experience: number;
		score: number;
	};

	penalty?: {
		type: SmallEventLimogesPenaltyType;
		amount: number;
	};
}
