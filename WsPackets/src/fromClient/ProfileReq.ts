import { FromClientPacket } from "./FromClientPacket";
import { AskedPlayer } from "../objects/AskedPlayer";

export class ProfileReq extends FromClientPacket {
	public static readonly wireName = "ProfileReq";

	public askedPlayer!: AskedPlayer;
}
