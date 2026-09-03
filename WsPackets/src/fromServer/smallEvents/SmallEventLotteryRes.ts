import { FromServerPacket } from "../FromServerPacket";

export type LotteryLevel = "easy" | "medium" | "hard";

export type LotteryReward = "money" | "xp" | "points" | "guildXp";

/** The lottery timed out before the player selected a level. */
export class SmallEventLotteryNoAnswerRes extends FromServerPacket {}

/** The player could not place the high-stakes lottery bet. */
export class SmallEventLotteryPoorRes extends FromServerPacket {}

/** The reward granted after a successful lottery choice. */
export class SmallEventLotteryWinRes extends FromServerPacket {
	lostTime!: number;

	winAmount!: number;

	winReward!: LotteryReward;

	level!: LotteryLevel;
}

/** The consequences applied after an unsuccessful lottery choice. */
export class SmallEventLotteryLoseRes extends FromServerPacket {
	moneyLost!: number;

	lostTime!: number;

	level!: LotteryLevel;
}
