import { FromClientPacket } from "./FromClientPacket";
import { AskedPlayer } from "../objects/AskedPlayer";

export class ProfileReq extends FromClientPacket {
	public static readonly wireName = "ProfileReq";

	public askedPlayer!: AskedPlayer;
}

/** Another player's profile, asked through the opaque handle a ranking sent with them. */
export class PlayerProfileReq extends FromClientPacket {
	public static readonly wireName = "PlayerProfileReq";

	public playerRef!: string;
}
