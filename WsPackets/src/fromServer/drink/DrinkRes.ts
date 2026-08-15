import { FromServerPacket } from "../FromServerPacket";
import { ItemNature } from "../../objects/ItemNature";

/**
 * Effect of the potion the player drank. `value` is expressed in the unit of its nature.
 */
export class DrinkRes extends FromServerPacket {
	value!: number;

	itemNature!: ItemNature;
}
