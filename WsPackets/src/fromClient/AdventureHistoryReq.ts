import { FromClientPacket } from "./FromClientPacket";

export class AdventureHistoryReq extends FromClientPacket {
	public static readonly wireName = "AdventureHistoryReq";

	page?: number;

	until?: number;
}
