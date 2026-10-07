import { FromServerPacket } from "../FromServerPacket";

/** A blessing was just invoked for every adventurer, pushed to the players connected at that moment. */
export class BlessingActivatedRes extends FromServerPacket {
	public static readonly wireName = "BlessingActivatedRes";

	public blessingType!: number;

	public durationHours!: number;
}
