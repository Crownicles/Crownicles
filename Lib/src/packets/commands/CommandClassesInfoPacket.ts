import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { ClassStats } from "../../types/ClassStats";

/**
 * Packet sent by the bot to gather information about selectable classes
 */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandClassesInfoPacketReq extends CrowniclesPacket {
	// No data needed
}

/**
 * Packet sent by the bot to display information about selectable classes
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandClassesInfoPacketRes extends CrowniclesPacket {
	data?: {
		classesStats: {
			id: number;
			stats: ClassStats;
			attacks: {
				id: string;
				cost: number;
			}[];
		}[];
	};
}
