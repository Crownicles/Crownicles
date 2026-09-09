import { FromServerPacket } from "../FromServerPacket";

export type LotteryLevel = "easy" | "medium" | "hard";

export type LotteryReward = "money" | "xp" | "points" | "guildXp";

/** The lottery timed out before the player selected a level. */
export class SmallEventLotteryNoAnswerRes extends FromServerPacket {
	public static readonly wireName = "SmallEventLotteryNoAnswerRes";
}

/** The player could not place the high-stakes lottery bet. */
export class SmallEventLotteryPoorRes extends FromServerPacket {
	public static readonly wireName = "SmallEventLotteryPoorRes";
}

/** The reward granted after a successful lottery choice. */
export class SmallEventLotteryWinRes extends FromServerPacket {
	public static readonly wireName = "SmallEventLotteryWinRes";

	lostTime!: number;

	winAmount!: number;

	winReward!: LotteryReward;

	level!: LotteryLevel;
}

/** The consequences applied after an unsuccessful lottery choice. */
export class SmallEventLotteryLoseRes extends FromServerPacket {
	public static readonly wireName = "SmallEventLotteryLoseRes";

	moneyLost!: number;

	lostTime!: number;

	level!: LotteryLevel;
}
