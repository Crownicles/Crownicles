import { FromClientPacket } from "./FromClientPacket";

export class SellReq extends FromClientPacket {
	public static readonly wireName = "SellReq";
}
