import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandBlessingPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandBlessingPacketRes extends CrowniclesPacket {
	/**
	 * Current active blessing type (0 = none)
	 */
	activeBlessingType!: number;

	/**
	 * When the current blessing ends (epoch ms), only set when a blessing is active
	 */
	blessingEndAt?: number;

	/**
	 * Current pool amount
	 */
	poolAmount!: number;

	/**
	 * Pool threshold to trigger next blessing
	 */
	poolThreshold!: number;

	/**
	 * Keycloak ID of the player who triggered the current/last blessing
	 */
	lastTriggeredByKeycloakId?: string;

	/**
	 * Keycloak ID of the top contributor for the current/last pool cycle
	 */
	topContributorKeycloakId?: string;

	/**
	 * Amount contributed by the top contributor
	 */
	topContributorAmount?: number;

	/**
	 * Total number of unique contributors for the current/last pool cycle
	 */
	totalContributors!: number;

	/**
	 * When the current pool expires (epoch ms), 0 if a blessing is active
	 */
	poolExpiresAt!: number;
}
