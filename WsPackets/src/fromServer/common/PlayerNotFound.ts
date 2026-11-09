import { FromServerPacket } from "../FromServerPacket";

export class PlayerNotFound extends FromServerPacket {
	public static readonly wireName = "PlayerNotFound";
}
