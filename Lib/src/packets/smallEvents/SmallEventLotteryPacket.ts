import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventLotteryNoAnswerPacket extends SmallEventPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventLotteryPoorPacket extends SmallEventPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventLotteryWinPacket extends SmallEventPacket {
	lostTime!: number;

	winAmount!: number;

	winReward!: "money" | "xp" | "points" | "guildXp";

	level!: "easy" | "medium" | "hard";
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventLotteryLosePacket extends SmallEventPacket {
	moneyLost!: number;

	lostTime!: number;

	level!: "easy" | "medium" | "hard";
}
