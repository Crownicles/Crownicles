import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SmallEventPacket } from "./SmallEventPacket";

export enum SmallEventLimogesPenaltyType {
	HEALTH = "health",
	MONEY = "money",
	TIME = "time"
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventLimogesPacket extends SmallEventPacket {
	questionId!: string;

	shouldHaveAccepted!: boolean;

	isSuccess!: boolean;

	reward?: {
		experience: number;
		score: number;
	};

	penalty?: {
		type: SmallEventLimogesPenaltyType;
		amount: number;
	};
}
