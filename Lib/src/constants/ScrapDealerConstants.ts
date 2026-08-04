export abstract class ScrapDealerConstants {
	/**
	 * The materials given back are worth `BASE_VALUE_MULTIPLIER + itemLevel * VALUE_MULTIPLIER_PER_LEVEL`
	 * times the item sell price, so upgrading an equipment before scrapping it stays more rewarding
	 * than scrapping it right away.
	 */
	static readonly BASE_VALUE_MULTIPLIER = 8;

	static readonly VALUE_MULTIPLIER_PER_LEVEL = 4;
}
