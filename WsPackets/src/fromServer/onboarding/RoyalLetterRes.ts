import { FromServerPacket } from "../FromServerPacket";

/** Pushed with the first report of each day of the newcomer's first week; its gifts are already credited. */
export class RoyalLetterRes extends FromServerPacket {
	public static readonly wireName = "RoyalLetterRes";

	/** From 1 to `letters`. */
	public letter!: number;

	public letters!: number;

	public tokens!: number;

	public money!: number;

	public gems!: number;

	public rank?: number;

	public rankedPlayers?: number;
}
