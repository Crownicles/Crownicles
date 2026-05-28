/**
 * Constants for the Royal Blacksmith menu IDs.
 */
export const RoyalBlacksmithMenuIds = {
	/** Main royal blacksmith menu */
	ROYAL_BLACKSMITH_MENU: "ROYAL_BLACKSMITH_MENU",

	/** Back to city option */
	BACK_TO_CITY: "ROYAL_BLACKSMITH_BACK_TO_CITY",

	/** Prefix for an item upgrade button (with owned materials). Followed by slot_category. */
	UPGRADE_PREFIX: "ROYAL_UPGRADE_",

	/** Prefix for an item upgrade button (buying missing materials). Followed by slot_category. */
	BUY_AND_UPGRADE_PREFIX: "ROYAL_BUY_AND_UPGRADE_"
} as const;
