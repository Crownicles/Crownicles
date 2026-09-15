import { FromServerPacket } from "../FromServerPacket";
import { ItemNature } from "../../objects/ItemNature";

/**
 * Effect of the potion the player drank. `value` is expressed in the unit of its nature.
 */
export class DrinkRes extends FromServerPacket {
	public static readonly wireName = "DrinkRes";

	value!: number;

	itemNature!: ItemNature;
}
