import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SmallEventPacket } from "./SmallEventPacket";

export enum SmallEventLimogesOutcome {
	SUCCESS = "success",
	FAILURE = "failure"
}

export type SmallEventLimogesPenaltyType = "health" | "money" | "time";

export type SmallEventLimogesAnswer = "accept" | "refuse";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventLimogesPacket extends SmallEventPacket {
	factKey!: string;

	questionId!: string;

	expectedAnswer!: SmallEventLimogesAnswer;

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
