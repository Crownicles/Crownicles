import { FromServerPacket } from "../FromServerPacket";

/**
 * The defense style changed. A missing personality means a different style is picked at random at
 * each fight. Personalities travel as their identifier, which names their translation and emoji, so
 * a style added on the server shows without a store release.
 */
export class DefenseRes extends FromServerPacket {
	public static readonly wireName = "DefenseRes";

	personality?: string;
}

/** The class of the player has a single way to defend itself: no choice is opened. */
export class DefenseNoChoiceRes extends FromServerPacket {
	public static readonly wireName = "DefenseNoChoiceRes";

	classId!: number;
}

/** The choice was left, or no longer fits the class of the player: the defense style did not change. */
export class DefenseCancelRes extends FromServerPacket {
	public static readonly wireName = "DefenseCancelRes";
}
