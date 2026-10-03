import { FromClientPacket } from "./FromClientPacket";
import { AskedPlayer } from "../objects/AskedPlayer";

export class MissionsReq extends FromClientPacket {
	public static readonly wireName = "MissionsReq";

	public askedPlayer!: AskedPlayer;

	/** Set when the app refreshes the missions on its own rather than because the player opened them. */
	public passive?: boolean;
}
