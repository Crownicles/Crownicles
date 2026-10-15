import { FromClientPacket } from "./FromClientPacket";
import { GardenOperation } from "../objects/Garden";

export class GardenInfoReq extends FromClientPacket {
	public static readonly wireName = "GardenInfoReq";
}
export class GardenActionReq extends FromClientPacket {
	public static readonly wireName = "GardenActionReq";

	operation!: GardenOperation;
}
