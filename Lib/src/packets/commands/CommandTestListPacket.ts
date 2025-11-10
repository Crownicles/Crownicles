import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

/**
 * Request to get the list of all available test commands
 */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandTestListPacketReq extends CrowniclesPacket {
	// Empty request packet - just triggers the list response
}

/**
 * Response containing all available test commands with their metadata
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTestListPacketRes extends CrowniclesPacket {
	/**
	 * Array of test commands with their names and aliases
	 */
	commands!: Array<{
		name: string;
		aliases?: string[];
		category?: string;
	}>;
}
