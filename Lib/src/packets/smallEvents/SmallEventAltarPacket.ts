import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SmallEventPacket } from "./SmallEventPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventAltarPacket extends SmallEventPacket {
	/**
	 * Whether the player contributed to the pool
	 */
	contributed!: boolean;

	/**
	 * Amount contributed (0 if refused)
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
	 * Whether the player had enough money
	 */
	hasEnoughMoney!: boolean;

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

	/**
	 * Whether this is the player's first encounter with the oracle
	 */
	firstEncounter!: boolean;
}
