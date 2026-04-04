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

	/** Confirm guild domain purchase or relocation */
	GUILD_DOMAIN_CONFIRM: "GUILD_DOMAIN_CONFIRM",

	/** Prefix for guild domain deposit buttons (followed by amount) */
	GUILD_DOMAIN_DEPOSIT_PREFIX: "GUILD_DOMAIN_DEPOSIT_",

	/** Guild domain deposit all money */
	GUILD_DOMAIN_DEPOSIT_ALL: "GUILD_DOMAIN_DEPOSIT_ALL",

	/** Prefix for guild domain building upgrade buttons (followed by building name) */
	GUILD_DOMAIN_UPGRADE_PREFIX: "GUILD_DOMAIN_UPGRADE_",

	/** Prefix for entering a guild domain building (followed by building name) */
	GUILD_DOMAIN_ENTER_PREFIX: "GUILD_DOMAIN_ENTER_",

	/** Back to guild domain main menu from a building sub-menu */
	GUILD_DOMAIN_BACK: "GUILD_DOMAIN_BACK",

	/** Guild domain shop sub-menu */
	GUILD_DOMAIN_SHOP_MENU: "GUILD_DOMAIN_SHOP_MENU",

	/** Guild domain shelter sub-menu */
	GUILD_DOMAIN_SHELTER_MENU: "GUILD_DOMAIN_SHELTER_MENU",

	/** Guild domain pantry sub-menu */
	GUILD_DOMAIN_PANTRY_MENU: "GUILD_DOMAIN_PANTRY_MENU",

	/** Guild domain training ground sub-menu */
	GUILD_DOMAIN_TRAINING_MENU: "GUILD_DOMAIN_TRAINING_MENU",

	/** Prefix for guild domain shop food buy buttons (followed by foodType_amount) */
	GUILD_DOMAIN_SHOP_FOOD_PREFIX: "GUILD_DOMAIN_SHOP_FOOD_",

	/** Prefix for guild domain shop XP buy buttons (followed by tier) */
	GUILD_DOMAIN_SHOP_XP_PREFIX: "GUILD_DOMAIN_SHOP_XP_",

	// --- Guild food shop (non-domain cities) ---
	/** Guild food shop sub-menu */
	GUILD_FOOD_SHOP_MENU: "GUILD_FOOD_SHOP_MENU",

	/** Prefix for food shop buy buttons (followed by foodType_amount) */
	GUILD_FOOD_SHOP_BUY_PREFIX: "GUILD_FOOD_SHOP_BUY_",

	/** Custom ID used for the "stay in city" button across all city sub-menus */
	STAY_IN_CITY: "STAY_IN_CITY"
} as const;
