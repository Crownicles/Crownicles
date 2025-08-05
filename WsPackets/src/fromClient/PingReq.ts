import { FromClientPacket } from "./FromClientPacket";

export class PingReq extends FromClientPacket {
	public time!: number;
}
