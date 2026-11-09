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
 * A class as shown in the list: its figures at the player's level and its attacks
 */
export type ClassInfo = {
	id: number;
	stats: ClassStats;
	attacks: {
		id: string;
		cost: number;
	}[];
};

/**
 * Packet sent by the bot to display information about selectable classes
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandClassesInfoPacketRes extends CrowniclesPacket {
	data?: {
		classesStats: ClassInfo[];

		/** The player's class when it belongs to another tier than the classes offered, so it can still be compared. */
		currentClass?: ClassInfo;

		/** Absent as soon as the player may change class again. */
		nextChangeTimestamp?: number;
	};
}
