import { FromClientPacket } from "./FromClientPacket";
import { AskedPlayer } from "../objects/AskedPlayer";

export class PetPowersReq extends FromClientPacket {
	public static readonly wireName = "PetPowersReq";
}

export class PetReq extends FromClientPacket {
	public static readonly wireName = "PetReq";

	public askedPlayer!: AskedPlayer;
}
