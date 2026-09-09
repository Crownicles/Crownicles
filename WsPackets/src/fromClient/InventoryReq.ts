import { FromClientPacket } from "./FromClientPacket";
import { AskedPlayer } from "../objects/AskedPlayer";

export class InventoryReq extends FromClientPacket {
	public static readonly wireName = "InventoryReq";

	askedPlayer!: AskedPlayer;
}
