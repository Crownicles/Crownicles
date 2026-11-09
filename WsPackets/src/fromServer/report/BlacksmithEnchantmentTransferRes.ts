import { FromServerPacket } from "../FromServerPacket";

/** The enchantment the city blacksmith just moved from one equipment to another of the same type. */
export class BlacksmithEnchantmentTransferRes extends FromServerPacket {
	public static readonly wireName = "BlacksmithEnchantmentTransferRes";

	enchantmentId!: string;

	enchantmentType!: string;

	/** Coins paid for the transfer. */
	cost!: number;
}
