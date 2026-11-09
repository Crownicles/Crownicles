import { FromServerPacket } from "../FromServerPacket";

/** The rent the notary just handed over for one apartment, as credited to the player. */
export class ApartmentRentRes extends FromServerPacket {
	public static readonly wireName = "ApartmentRentRes";

	mapLocationId!: number;

	rent!: number;
}
