/**
 * Constants for city menu IDs.
 * These are used as custom IDs for Discord buttons in the city report menus.
 */
export const ReportCityMenuIds = {
	// --- Navigation ---
	/** Back to city main menu from any sub-menu */
	BACK_TO_CITY: "BACK_TO_CITY",

	/** Blacksmith sub-menu */
	BLACKSMITH_MENU: "BLACKSMITH_MENU",

	/** Enchanter sub-menu */
	ENCHANTER_MENU: "ENCHANTER_MENU",

	// --- Main menu actions ---
	/** Exit city button */
	MAIN_MENU_EXIT_CITY: "MAIN_MENU_EXIT_CITY",

	/** Stay in city button (main menu variant) */
	MAIN_MENU_STAY_CITY: "MAIN_MENU_STAY_CITY",

	// --- Prefixes ---
	/** Prefix for city shop buttons (followed by shopId) */
	CITY_SHOP_PREFIX: "CITY_SHOP_",

	/** Prefix for inn buttons on main menu (followed by innId) */
	MAIN_MENU_INN_PREFIX: "MAIN_MENU_INN_",

	/** Prefix for inn sub-menu keys (followed by innId) */
	INN_PREFIX: "INN_",

	/** Prefix for meal buttons in inn menu (followed by mealId) */
	MEAL_PREFIX: "MEAL_",

	/** Prefix for room buttons in inn menu (followed by roomId) */
	ROOM_PREFIX: "ROOM_",

	/** Prefix for enchant item buttons (followed by index) */
	ENCHANT_ITEM_PREFIX: "ENCHANT_ITEM_",

	// --- Notary actions ---
	/** Buy a new home */
	BUY_HOME: "BUY_HOME",

	/** Upgrade existing home */
	UPGRADE_HOME: "UPGRADE_HOME",

	/** Move home to current city */
	MOVE_HOME: "MOVE_HOME",

	// --- Guild domain ---
	/** Guild domain sub-menu */
	GUILD_DOMAIN_MENU: "GUILD_DOMAIN_MENU",

	/** Guild domain notary sub-menu */
	GUILD_DOMAIN_NOTARY_MENU: "GUILD_DOMAIN_NOTARY_MENU",

	/** Confirm guild domain purchase or relocation */
	GUILD_DOMAIN_CONFIRM: "GUILD_DOMAIN_CONFIRM"

	/** Custom ID used for the "stay in city" button across all city sub-menus */
	STAY_IN_CITY: "STAY_IN_CITY"
} as const;
