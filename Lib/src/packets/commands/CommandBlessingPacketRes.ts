import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandBlessingPacketRes extends CrowniclesPacket {
	/**
	 * Current active blessing type (0 = none)
	 */
	activeBlessingType!: number;

	/**
	 * When the current blessing ends (epoch ms), 0 if no active blessing
	 */
	blessingEndAt!: number;

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
	lastTriggeredByKeycloakId!: string;

	/**
	 * Whether the player can claim the retroactive daily mission bonus
	 */
	canClaimDailyBonus!: boolean;
}
