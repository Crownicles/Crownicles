import { FromServerPacket } from "../FromServerPacket";

/** Pushed when a character levels up; a guild reward can level up the other members too. */
export class PlayerLevelUpRes extends FromServerPacket {
	public static readonly wireName = "PlayerLevelUpRes";

	/** Whether the character who levelled up is the one this app plays. */
	public self!: boolean;

	public level!: number;

	public healthRestored!: boolean;

	public statsIncreased!: boolean;

	public missionSlotUnlocked!: boolean;
}
