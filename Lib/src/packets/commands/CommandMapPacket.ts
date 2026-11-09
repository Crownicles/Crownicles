import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { Language } from "../../Language";
import { MapCity } from "../../types/MapCity";

/**
 * Packet sent by the bot to get the map of a player
 */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandMapPacketReq extends CrowniclesPacket {
	language!: Language;
}


/**
 * Packet sent by the bot to display the map of a player
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandMapDisplayRes extends CrowniclesPacket {
	cities!: MapCity[];

	mapId!: number;

	mapType!: string;

	mapLink!: {
		name: string;
		fallback?: string;
		forced: boolean;
	};

	hasArrived!: boolean;
}
