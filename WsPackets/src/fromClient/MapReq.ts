import { FromClientPacket } from "./FromClientPacket";

export class MapReq extends FromClientPacket {
	public static readonly wireName = "MapReq";

	language!: string;
}
