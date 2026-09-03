import {ReactionCollectorDataKind, ReactionCollectorReactionKind} from "../ReactionCollectorProtocol";
import {ItemWithDetails} from "../../../objects/ItemWithDetails";

/**
 * The city shop is a collector in its own right.  Keeping its payload in the collector contract
 * lets the mobile client render the shop instead of falling back to the generic "unknown action"
 * prompt when a player opens a city commerce.
 */
declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		shop: {
			availableCurrency: number;
			currency: "money" | "gem";
			additionalShopData?: {
				remainingPotions?: number;
				dailyPotion?: ItemWithDetails;
				gemToMoneyRatio?: number;
				remainingTokens?: number;
				weeklyPlants?: number[];
			};
		};
	}

	interface ReactionCollectorReactionPayloads {
		shopItem: {
			shopCategoryId: string;
			shopItemId: number;
			price: number;
			amount: number;
		};
		shopClose: Record<string, never>;
	}
}

export const SHOP_DATA_KINDS = {
	COLLECTOR: "shop"
} as const satisfies Record<string, ReactionCollectorDataKind>;

export const SHOP_REACTION_KINDS = {
	ITEM: "shopItem",
	CLOSE: "shopClose"
} as const satisfies Record<string, ReactionCollectorReactionKind>;
