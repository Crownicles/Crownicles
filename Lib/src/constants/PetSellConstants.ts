export abstract class PetSellConstants {
	static readonly SELL_PRICE = {
		MIN: 100,
		MAX: 50000
	};

	/**
	 * Treasury penalty applied when a pet is sold: a percentage of the sell price is
	 * deducted from the amount that goes into the seller guild's treasury, capped at
	 * a fixed maximum.
	 */
	static readonly TREASURY_PENALTY = {
		PERCENT: 0.05,
		MAX: 350
	};
}
