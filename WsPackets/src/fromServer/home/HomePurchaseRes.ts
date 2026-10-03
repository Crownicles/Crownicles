import { FromServerPacket } from "../FromServerPacket";

export const HOME_PURCHASES = {
	HOME: "home",
	UPGRADE: "upgrade",
	MOVE: "move",
	APARTMENT: "apartment"
} as const;

export type HomePurchase = typeof HOME_PURCHASES[keyof typeof HOME_PURCHASES];

/** A home bought, upgraded or moved, or an apartment bought at the notary. */
export class HomePurchaseRes extends FromServerPacket {
	public static readonly wireName = "HomePurchaseRes";

	purchase!: HomePurchase;

	cost!: number;

	/** The home's level once the purchase is done; absent for an apartment. */
	homeLevel?: number;

	/** Where the apartment stands; only for an apartment. */
	mapLocationId?: number;
}
