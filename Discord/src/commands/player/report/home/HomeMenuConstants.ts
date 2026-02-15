/**
 * Constants for home menu IDs.
 * These are used as custom IDs for Discord select menus and buttons.
 */
export const HomeMenuIds = {
	// --- Menus ---
	/** Main home menu */
	MAIN_MENU: "HOME_MAIN_MENU",

	/** Home menu (navigation key) */
	HOME_MENU: "HOME_MENU",

	/** Manage home menu (notary) */
	MANAGE_HOME_MENU: "MANAGE_HOME_MENU",

	/** Upgrade station feature menu */
	UPGRADE_STATION_MENU: "HOME_UPGRADE_STATION_MENU",

	// --- Navigation ---
	/** Option to leave the home and return to city */
	LEAVE_HOME: "LEAVE_HOME",

	/** Option to go back to the main home menu */
	BACK_TO_HOME: "BACK_TO_HOME",

	/** Back to items list button */
	UPGRADE_BACK_TO_ITEMS: "BACK_TO_ITEMS",

	// --- Prefixes ---
	/** Prefix for upgrade item selection */
	UPGRADE_ITEM_PREFIX: "UPGRADE_ITEM_",

	/** Prefix for upgrade confirmation */
	UPGRADE_CONFIRM_PREFIX: "CONFIRM_UPGRADE_",

	/** Prefix for item detail sub-menu */
	UPGRADE_ITEM_DETAIL_PREFIX: "UPGRADE_ITEM_DETAIL_",

	// --- Chest feature ---
	/** Chest feature menu */
	CHEST_MENU: "HOME_CHEST_MENU",

	/** Prefix for chest category selection */
	CHEST_CATEGORY_PREFIX: "CHEST_CAT_",

	/** Prefix for chest deposit action */
	CHEST_DEPOSIT_PREFIX: "CHEST_DEPOSIT_",

	/** Prefix for chest withdraw action */
	CHEST_WITHDRAW_PREFIX: "CHEST_WITHDRAW_",

	/** Back to chest categories */
	CHEST_BACK_TO_CATEGORIES: "CHEST_BACK_CATEGORIES",

	/** Prefix for chest category detail sub-menu */
	CHEST_CATEGORY_DETAIL_PREFIX: "CHEST_CAT_DETAIL_",

	/** Prefix for chest swap action (step 1: select inventory item) */
	CHEST_SWAP_SELECT_PREFIX: "CHEST_SWAP_SEL_",

	/** Prefix for chest swap target (step 2: select chest item to swap with) */
	CHEST_SWAP_TARGET_PREFIX: "CHEST_SWAP_TGT_",

	/** Prefix for chest swap target sub-menu */
	CHEST_SWAP_MENU_PREFIX: "CHEST_SWAP_MENU_",

	/** Back to category detail from swap menu */
	CHEST_BACK_TO_DETAIL_PREFIX: "CHEST_BACK_DETAIL_",

	/** Chest plant tab */
	CHEST_PLANT_TAB: "CHEST_PLANT_TAB",

	/** Prefix for chest plant deposit (player → home) */
	CHEST_PLANT_DEPOSIT_PREFIX: "CHEST_PLANT_DEP_",

	/** Prefix for chest plant withdraw (home → player) */
	CHEST_PLANT_WITHDRAW_PREFIX: "CHEST_PLANT_WDR_",

	// --- Garden feature ---
	/** Garden feature menu */
	GARDEN_MENU: "HOME_GARDEN_MENU",

	/** Harvest all ready plants */
	GARDEN_HARVEST: "GARDEN_HARVEST",

	/** Prefix for planting in a specific slot */
	GARDEN_PLANT_PREFIX: "GARDEN_PLANT_",

	/** View plant storage */
	GARDEN_STORAGE: "GARDEN_STORAGE",

	/** Back to garden from storage */
	GARDEN_BACK: "GARDEN_BACK"
} as const;
