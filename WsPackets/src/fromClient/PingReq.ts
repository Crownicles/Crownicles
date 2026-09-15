import { FromClientPacket } from "./FromClientPacket";

export class PingReq extends FromClientPacket {
	public static readonly wireName = "PingReq";

	public time!: number;
}
