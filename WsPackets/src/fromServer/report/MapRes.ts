import { FromServerPacket } from "../FromServerPacket";

export class MapRes extends FromServerPacket {
	public static readonly wireName = "MapRes";

	mapId!: number;

	mapType!: string;

	hasArrived!: boolean;

	imageUrl!: string;

	fallbackImageUrl?: string;
}
