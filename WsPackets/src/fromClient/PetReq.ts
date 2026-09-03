import { FromClientPacket } from "./FromClientPacket";
import { AskedPlayer } from "../objects/AskedPlayer";

export class PetReq extends FromClientPacket {
	public askedPlayer!: AskedPlayer;
}
