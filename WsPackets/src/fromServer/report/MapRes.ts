import { FromServerPacket } from "../FromServerPacket";
import { MapCity } from "../../objects/MapCity";

export class MapRes extends FromServerPacket {
	public static readonly wireName = "MapRes";

	mapId!: number;

	mapType!: string;

	hasArrived!: boolean;

	imageUrl!: string;

	fallbackImageUrl?: string;

	cities!: MapCity[];
}
