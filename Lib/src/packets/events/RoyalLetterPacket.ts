import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

/** A letter of the king, delivered with the first report of each day of the newcomer's first week. Its gifts are already credited. */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class RoyalLetterPacket extends CrowniclesPacket {
	keycloakId!: string;

	/** From 1 to the number of letters of the contest week. */
	letter!: number;

	letters!: number;

	tokens!: number;

	money!: number;

	gems!: number;

	/** The player's place in the contest, when they are ranked. */
	rank?: number;

	rankedPlayers?: number;
}
