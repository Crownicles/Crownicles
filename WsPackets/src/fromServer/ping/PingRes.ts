import { FromServerPacket } from "../FromServerPacket";

export class PingRes extends FromServerPacket {
	public static readonly wireName = "PingRes";

	public time!: number;
}
