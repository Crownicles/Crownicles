import { FromServerPacket } from "../FromServerPacket";

/** The enchantment Mernil, the travelling enchanter, just removed for free. */
export class EnchanterDisenchantRes extends FromServerPacket {
	public static readonly wireName = "EnchanterDisenchantRes";

	enchantmentId!: string;

	enchantmentType!: string;
}
