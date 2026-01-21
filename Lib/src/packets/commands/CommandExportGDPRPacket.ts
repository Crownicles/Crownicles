import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

/**
 * GDPR export request packet
 * Sent from Discord to Core to request a player's GDPR data export
 */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandExportGDPRReq extends CrowniclesPacket {
	/**
	 * The keycloakId of the player to export data for
	 */
	keycloakId!: string;

	/**
	 * The keycloakId of the admin requesting the export
	 * The result will be sent as a DM to this user
	 */
	requesterKeycloakId!: string;
}

/**
 * GDPR export response packet
 * Simple acknowledgment that the export has started
 * The actual data will be sent via GDPRExportCompleteNotificationPacket as a DM
 */
@sendablePacket(PacketDirection.NONE)
export class CommandExportGDPRRes extends CrowniclesPacket {
	/**
	 * Whether the export has started successfully
	 */
	started!: boolean;

	/**
	 * Error message if export could not start (e.g., player not found)
	 */
	error?: string;
}
