import { FromClientPacket } from "./FromClientPacket";
import { AskedPlayer } from "../objects/AskedPlayer";

export class MissionsReq extends FromClientPacket {
	public static readonly wireName = "MissionsReq";

	public askedPlayer!: AskedPlayer;
}
