import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

/**
 * GDPR export request packet
 * Sent from Discord to Core to request a player's GDPR data export
 */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandExportGDPRReq extends CrowniclesPacket {
	keycloakId!: string;
}

/**
 * GDPR export response packet
 * Contains all player data as CSV strings, with anonymized identifiers
 * Each key is the table name, value is the CSV content
 */
@sendablePacket(PacketDirection.NONE)
export class CommandExportGDPRRes extends CrowniclesPacket {
	/**
	 * Whether the player exists in the database
	 */
	exists!: boolean;

	/**
	 * Error message if export failed
	 */
	error?: string;

	/**
	 * Map of table names to CSV content
	 * Keys are filenames (e.g., "player.csv", "inventory.csv")
	 * Values are the CSV content with anonymized data
	 */
	csvFiles!: Record<string, string>;

	/**
	 * The anonymized ID used for the player in all files
	 * This allows the user to cross-reference their data
	 */
	anonymizedPlayerId!: string;
}
