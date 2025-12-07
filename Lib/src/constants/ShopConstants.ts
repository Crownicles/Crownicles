export abstract class ShopConstants {
	static readonly RANDOM_ITEM_PRICE = 350;

	static readonly ALTERATION_HEAL_BASE_PRICE = 510;

	static readonly MAX_REDUCTION_TIME = 90; // Minutes

	static readonly MIN_REDUCTION_TIME = 15; // Minutes

	static readonly MAX_PRICE_REDUCTION_DIVISOR = 5;

	static readonly MAX_DAILY_POTION_BUYOUTS = 5;

	static readonly FULL_REGEN_PRICE = 3000;

	static readonly MONEY_MOUTH_BADGE_PRICE = 25000;

	static readonly DAILY_POTION_DISCOUNT_MULTIPLIER = 0.7;

	static readonly TOKEN_PRICE = 375;

	static readonly MAX_DAILY_TOKEN_BUYOUTS = 5;
}

export enum ShopCurrency {
	MONEY = "money",
	GEM = "gem"
}
