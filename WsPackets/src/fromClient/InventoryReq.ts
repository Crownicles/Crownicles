import { FromClientPacket } from "./FromClientPacket";
import { AskedPlayer } from "../objects/AskedPlayer";

export class InventoryReq extends FromClientPacket {
	askedPlayer!: AskedPlayer;
}
