import {FromServerPacket} from "../FromServerPacket";

export class PingRes extends FromServerPacket {
	public time!: number;
}