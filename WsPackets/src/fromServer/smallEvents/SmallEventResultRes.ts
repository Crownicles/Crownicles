import { FromServerPacket } from "../FromServerPacket";

export class SmallEventResultRes extends FromServerPacket {
	public static readonly wireName = "SmallEventResultRes";

	eventName!: string;

	data!: Record<string, unknown>;
}
