import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandBlessingClaimDailyPacketRes extends CrowniclesPacket {
	/**
	 * Whether the claim was successful
	 */
	success!: boolean;

	/**
	 * Gems earned from the bonus
	 */
	gemsWon!: number;

	/**
	 * XP earned from the bonus
	 */
	xpWon!: number;

	/**
	 * Money earned from the bonus
	 */
	moneyWon!: number;

	/**
	 * Points earned from the bonus
	 */
	pointsWon!: number;
}
