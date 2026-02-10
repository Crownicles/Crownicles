import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SmallEventPacket } from "./SmallEventPacket";

/**
 * Sent when the player encounters the oracle for the first time (intro / rune marking)
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventAltarFirstEncounterPacket extends SmallEventPacket {
}

/**
 * Sent when the player does not contribute: refused, timed out, or not enough money
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventAltarNoContributionPacket extends SmallEventPacket {
	/**
	 * Amount the player tried to contribute (0 if refused/timeout)
	 */
	amount!: number;

	/**
	 * Current pool amount
	 */
	newPoolAmount!: number;

	/**
	 * Pool threshold
	 */
	poolThreshold!: number;

	/**
	 * Whether the player had enough money (false = tried but couldn't afford)
	 */
	hasEnoughMoney!: boolean;
}

/**
 * Sent when the player successfully contributes to the pool
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventAltarContributedPacket extends SmallEventPacket {
	/**
	 * Amount contributed
	 */
	amount!: number;

	/**
	 * Whether the pool was filled and a blessing was triggered
	 */
	blessingTriggered!: boolean;

	/**
	 * The blessing type that was triggered (0 if none)
	 */
	blessingType!: number;

	/**
	 * New pool amount after contribution
	 */
	newPoolAmount!: number;

	/**
	 * Pool threshold
	 */
	poolThreshold!: number;

	/**
	 * Number of bonus gems awarded (0 if none)
	 */
	bonusGems!: number;

	/**
	 * Whether a bonus random item was given
	 */
	bonusItemGiven!: boolean;

	/**
	 * Whether the Oracle Patron badge was awarded
	 */
	badgeAwarded!: boolean;
}
