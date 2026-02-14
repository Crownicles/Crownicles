/**
 * Constants for blacksmith menu IDs.
 * These are used as custom IDs for Discord select menus and buttons.
 */
export const BlacksmithMenuIds = {
	// --- Menus ---
	/** Main blacksmith menu */
	BLACKSMITH_MENU: "BLACKSMITH_MENU",

	/** Upgrade items selection menu */
	UPGRADE_MENU: "BLACKSMITH_UPGRADE_MENU",

	/** Disenchant items selection menu */
	DISENCHANT_MENU: "BLACKSMITH_DISENCHANT_MENU",

	// --- Navigation ---
	/** Back to city option */
	BACK_TO_CITY: "BACK_TO_CITY",

	/** Back to blacksmith main menu */
	BACK_TO_BLACKSMITH: "BACK_TO_BLACKSMITH",

	/** Back to upgrade items list */
	BACK_TO_UPGRADE_LIST: "BACK_TO_UPGRADE_LIST",

	/** Back to disenchant items list */
	BACK_TO_DISENCHANT_LIST: "BACK_TO_DISENCHANT_LIST",

	// --- Actions ---
	/** Confirm upgrade button */
	CONFIRM_UPGRADE: "CONFIRM_UPGRADE",

	/** Buy materials and upgrade button */
	BUY_AND_UPGRADE: "BUY_AND_UPGRADE",

	/** Confirm disenchant button */
	CONFIRM_DISENCHANT: "CONFIRM_DISENCHANT",

	// --- Prefixes ---
	/** Prefix for upgrade item selection */
	UPGRADE_ITEM_PREFIX: "UPGRADE_ITEM_",

	/** Prefix for disenchant item selection */
	DISENCHANT_ITEM_PREFIX: "DISENCHANT_ITEM_",

	// --- Select menus ---
	/** Upgrade item select menu custom ID */
	UPGRADE_SELECT: "BLACKSMITH_UPGRADE_SELECT",

	/** Disenchant item select menu custom ID */
	DISENCHANT_SELECT: "BLACKSMITH_DISENCHANT_SELECT"
} as const;
