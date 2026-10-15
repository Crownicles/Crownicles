import {
	ReactionCollectorDataKind, ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";
import { ItemWithDetails } from "../../../objects/ItemWithDetails";
import { Mission } from "../../../objects/Mission";

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
			shopId?: string;
			additionalShopData?: {
				remainingPotions?: number;
				dailyPotion?: ItemWithDetails;
				gemToMoneyRatio?: number;
				remainingTokens?: number;
				weeklyPlants?: number[];
				thousandPoints?: number;
			};
		};

		/** Asks which of the running missions the player wants to trade away. */
		shopSkipMission: Record<string, never>;

		/** Asks which inventory category the bought slot belongs to. */
		shopBuySlot: Record<string, never>;
	}

	interface ReactionCollectorReactionPayloads {
		shopItem: {
			shopCategoryId: string;
			shopItemId: number;
			price: number;
			amount: number;
		};
		shopClose: Record<string, never>;
		shopSkipMissionEntry: {
			missionIndex: number;
			mission: Mission;
		};
		shopBuySlotCategory: {
			categoryId: number;
			maxSlots: number;
			remaining: number;
		};
	}
}

export const SHOP_DATA_KINDS = {
	COLLECTOR: "shop",
	SKIP_MISSION: "shopSkipMission",
	BUY_SLOT: "shopBuySlot"
} as const satisfies Record<string, ReactionCollectorDataKind>;

export const SHOP_REACTION_KINDS = {
	ITEM: "shopItem",
	CLOSE: "shopClose",
	SKIP_MISSION_ENTRY: "shopSkipMissionEntry",
	BUY_SLOT_CATEGORY: "shopBuySlotCategory"
} as const satisfies Record<string, ReactionCollectorReactionKind>;
