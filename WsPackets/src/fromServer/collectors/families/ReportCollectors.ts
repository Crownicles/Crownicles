import {
	ReactionCollectorDataKind, ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		reportDestination: Record<string, never>;
		reportUseTokens: {
			cost: number;
			playerTokens: number;
		};
		reportBuyHeal: {
			healPrice: number;
			playerMoney: number;
		};
		reportTokenMerchant: {
			pricePerToken: number;
			playerMoney: number;
			playerTokens: number;
			maxTokens: number;
			maxDaily: number;
			maxWeekly: number;
			amounts: number[];
		};
	}

	interface ReactionCollectorReactionPayloads {
		reportDestination: {
			mapId: number;
			mapTypeId: string;
			tripDuration?: number;
		};
		reportStayInCity: Record<string, never>;
		reportTokenMerchantBuy: {
			amount: number;
		};
	}
}

/** Collectors that move the player through the report's adventure flow. */
export const REPORT_COLLECTOR_DATA_KINDS = {
	DESTINATION: "reportDestination",
	USE_TOKENS: "reportUseTokens",
	BUY_HEAL: "reportBuyHeal",
	TOKEN_MERCHANT: "reportTokenMerchant"
} as const satisfies Record<string, ReactionCollectorDataKind>;

export const REPORT_COLLECTOR_REACTION_KINDS = {
	DESTINATION: "reportDestination",
	STAY_IN_CITY: "reportStayInCity",
	TOKEN_MERCHANT_BUY: "reportTokenMerchantBuy"
} as const satisfies Record<string, ReactionCollectorReactionKind>;
