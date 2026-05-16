export type ChestAction = typeof HomeConstants.CHEST_ACTIONS[keyof typeof HomeConstants.CHEST_ACTIONS];

export abstract class HomeConstants {
	/**
	 * Flat price (in coins) to move an existing home to a different city.
	 * Independent of the home's level and the target city.
	 */
	public static readonly MOVE_HOME_PRICE_DEFAULT = 15_000;

	/**
	 * Reduced price applied when the target city is one of the least-populated cities.
	 * Acts as a soft incentive against player concentration in popular cities.
	 */
	public static readonly MOVE_HOME_PRICE_LEAST_POPULATED = 1_000;

	public static readonly CHEST_ACTIONS = {
		DEPOSIT: "deposit",
		WITHDRAW: "withdraw",
		SWAP: "swap"
	} as const;

	public static readonly CHEST_ERRORS = {
		INVALID: "invalid",
		CHEST_FULL: "chestFull",
		INVENTORY_FULL: "inventoryFull"
	} as const;

	public static readonly PLANT_TRANSFER_ACTIONS = {
		DEPOSIT: "plantDeposit",
		WITHDRAW: "plantWithdraw"
	} as const;

	public static readonly PLANT_TRANSFER_ERRORS = {
		INVALID: "invalid",
		STORAGE_FULL: "storageFull",
		NO_EMPTY_SLOT: "noEmptySlot",
		NOT_FOUND: "notFound"
	} as const;

	/**
	 * Threshold for advanced upgrade level features.
	 * Homes with maxItemUpgradeLevel >= this value get "advanced" description.
	 */
	public static readonly ADVANCED_UPGRADE_LEVEL_THRESHOLD = 2;
}
