import { NotificationPacket } from "./NotificationPacket";

/**
 * Notification sent when a GDPR export is complete
 * Contains the CSV files as a map, ready to be zipped and sent as DM
 */
export class GDPRExportCompleteNotificationPacket extends NotificationPacket {
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

	/**
	 * The keycloakId of the exported player (for reference in logs)
	 */
	exportedPlayerKeycloakId!: string;

	/**
	 * Error message if export failed
	 */
	error?: string;
}
