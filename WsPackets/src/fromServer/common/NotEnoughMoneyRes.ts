import { FromServerPacket } from "../FromServerPacket";

/** A purchase refused because the player's money ran out before the server could take it. */
export class NotEnoughMoneyRes extends FromServerPacket {
	public static readonly wireName = "NotEnoughMoneyRes";

	missingMoney!: number;
}
