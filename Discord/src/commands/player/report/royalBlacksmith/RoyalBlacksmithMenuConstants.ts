/**
 * Constants for the Royal Blacksmith menu IDs.
 */
export const RoyalBlacksmithMenuIds = {
	/** Main royal blacksmith menu (status screen) */
	ROYAL_BLACKSMITH_MENU: "ROYAL_BLACKSMITH_MENU",

	/** Item selection menu (only shown when status is "ready") */
	UPGRADE_MENU: "ROYAL_BLACKSMITH_UPGRADE_MENU",

	/** Back to city option */
	BACK_TO_CITY: "ROYAL_BLACKSMITH_BACK_TO_CITY",

	/** Back to royal blacksmith status screen */
	BACK_TO_ROYAL_BLACKSMITH: "ROYAL_BLACKSMITH_BACK",

	/** Back to upgrade items list */
	BACK_TO_UPGRADE_LIST: "ROYAL_BLACKSMITH_BACK_TO_LIST",

	/** Prefix for an item selection button. Followed by slot_category. */
	UPGRADE_ITEM_PREFIX: "ROYAL_UPGRADE_ITEM_",

	/** Confirm upgrade on the item detail screen */
	CONFIRM_UPGRADE: "ROYAL_CONFIRM_UPGRADE",

	/** Buy missing materials then upgrade on the item detail screen */
	BUY_AND_UPGRADE: "ROYAL_BUY_AND_UPGRADE"
} as const;
