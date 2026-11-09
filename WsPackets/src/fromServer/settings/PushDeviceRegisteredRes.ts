import { FromServerPacket } from "../FromServerPacket";

/** The device now receives the player's notifications. */
export class PushDeviceRegisteredRes extends FromServerPacket {
	public static readonly wireName = "PushDeviceRegisteredRes";
}
