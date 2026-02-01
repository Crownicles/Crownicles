import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventGobletsGamePacket extends SmallEventPacket {
	malus!: SmallEventGobletsGameMalus;

	goblet!: string;

	value!: number;

	strategy!: SmallEventGobletsGameStrategy;


	/**
	 * Item id if the player wins an item (only for RISKY strategy)
	 */
	itemId?: number;

	/**
	 * Item category if the player wins an item (only for RISKY strategy)
	 */
	itemCategory?: number;
}

export enum SmallEventGobletsGameMalus {
	LIFE = "life",
	TIME = "time",
	NOTHING = "nothing",
	END = "end",
	ITEM = "item"
}

export enum SmallEventGobletsGameStrategy {

	/**
	 * Classic behavior - same as before
	 */

	CLASSIC = "classic",

	/**
	 * Risky - 0.5% chance to get epic/legendary/mythic item, but higher penalties (only 10% nothing instead of 33%)
	 */

	RISKY = "risky",

	/**
	 * Safe - always a malus, but 33% weaker
	 */

	SAFE = "safe",

	/**
	 * Gambler - 90% chance of nothing, but malus are 6.6x stronger
	 */

	GAMBLER = "gambler"
}
