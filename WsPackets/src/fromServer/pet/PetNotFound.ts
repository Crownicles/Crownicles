import { FromServerPacket } from "../FromServerPacket";

/**
 * The player exists but owns no pet.
 */
export class PetNotFound extends FromServerPacket {
	public static readonly wireName = "PetNotFound";
}
