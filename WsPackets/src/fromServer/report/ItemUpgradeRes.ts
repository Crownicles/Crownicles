import { FromServerPacket } from "../FromServerPacket";

/** Who did the work: the home's own station, the city blacksmith or the royal one. */
export const ITEM_UPGRADE_ARTISANS = {
	HOME: "home",
	BLACKSMITH: "blacksmith",
	ROYAL_BLACKSMITH: "royalBlacksmith"
} as const;

export type ItemUpgradeArtisan = typeof ITEM_UPGRADE_ARTISANS[keyof typeof ITEM_UPGRADE_ARTISANS];

/** A weapon or an armor just raised by one level. */
export class ItemUpgradeRes extends FromServerPacket {
	public static readonly wireName = "ItemUpgradeRes";

	artisan!: ItemUpgradeArtisan;

	itemId!: number;

	itemCategory!: number;

	itemLevel!: number;

	/** Coins paid, missing materials bought included; nothing at home. */
	moneySpent!: number;

	/** Only the royal blacksmith asks for gems. */
	gemsSpent?: number;
}
