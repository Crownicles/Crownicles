import { FromClientPacket } from "./FromClientPacket";
import { AskedPlayer } from "../objects/AskedPlayer";

export class ProfileReq extends FromClientPacket {
	public askedPlayer!: AskedPlayer;
}
