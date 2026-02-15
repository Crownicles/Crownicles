export type ChestAction = typeof HomeConstants.CHEST_ACTIONS[keyof typeof HomeConstants.CHEST_ACTIONS];

export abstract class HomeConstants {
	public static readonly PONDERATION_MINIMUM = 0.5;

	public static readonly MOST_POPULATED_CITY_PRICE_MALUS = 1.2;

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
