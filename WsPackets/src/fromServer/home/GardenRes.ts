import { FromServerPacket } from "../FromServerPacket";
import { GardenOutcome } from "../../objects/Garden";

export class GardenRes extends FromServerPacket {
	public static readonly wireName = "GardenRes";

	outcome!: GardenOutcome;
}
