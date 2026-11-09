import { FromClientPacket } from "./FromClientPacket";

/** Whether the app is in front of the player: while it is, their devices are not pushed what it already shows. */
export class AppPresenceReq extends FromClientPacket {
	public static readonly wireName = "AppPresenceReq";

	foreground!: boolean;
}
