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

	// --- Apartment notary (inside notary sub-menu) ---
	/** Buy an apartment in current city */
	APARTMENT_BUY: "APARTMENT_BUY",

	/** Prefix for claim-rent buttons (followed by apartmentId) */
	APARTMENT_CLAIM_RENT_PREFIX: "APARTMENT_CLAIM_RENT_",

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

	/** Prefix for the per-food-type buttons on the shop main menu (followed by foodType) */
	GUILD_DOMAIN_SHOP_FOOD_OPEN_PREFIX: "GUILD_DOMAIN_SHOP_FOODOPEN_",

	/** Custom ID for the treasury button on the shop main menu */
	GUILD_DOMAIN_SHOP_TREASURY_OPEN: "GUILD_DOMAIN_SHOP_TREASURY_OPEN",

	/** Prefix for guild domain shop food buy buttons (followed by foodType_amount) */
	GUILD_DOMAIN_SHOP_FOOD_PREFIX: "GUILD_DOMAIN_SHOP_FOOD_",

	/** Prefix for guild domain shop treasury deposit buttons (followed by gross amount) */
	GUILD_DOMAIN_SHOP_DEPOSIT_PREFIX: "GUILD_DOMAIN_SHOP_DEPOSIT_",

	/** Custom ID for the back-to-shop button on the quantity / treasury sub-menus */
	GUILD_DOMAIN_SHOP_QUANTITY_CANCEL: "GUILD_DOMAIN_SHOP_QUANTITY_CANCEL",

	/** Dynamically registered quantity sub-menu (food or treasury) */
	GUILD_DOMAIN_SHOP_QUANTITY_MENU: "GUILD_DOMAIN_SHOP_QUANTITY_MENU",

	/** Dynamically registered post-purchase reimburse menu */
	GUILD_DOMAIN_SHOP_REIMBURSE_MENU: "GUILD_DOMAIN_SHOP_REIMBURSE_MENU",

	/** Prefix for guild domain shop reimburse buttons (followed by gross amount) */
	GUILD_DOMAIN_SHOP_REIMBURSE_PREFIX: "GUILD_DOMAIN_SHOP_REIMBURSE_",

	/** Custom ID used to decline the post-purchase reimbursement prompt */
	GUILD_DOMAIN_SHOP_REIMBURSE_DECLINE: "GUILD_DOMAIN_SHOP_REIMBURSE_DECLINE",

	// --- Guild food shop (non-domain cities) ---
	/** Guild food shop sub-menu */
	GUILD_FOOD_SHOP_MENU: "GUILD_FOOD_SHOP_MENU",

	/** Prefix for food shop buy buttons (followed by foodType_amount) */
	GUILD_FOOD_SHOP_BUY_PREFIX: "GUILD_FOOD_SHOP_BUY_",

	/** Prefix for guild food shop reimburse buttons (followed by gross amount) */
	GUILD_FOOD_SHOP_REIMBURSE_PREFIX: "GUILD_FOOD_SHOP_REIMBURSE_",

	/** Custom ID used to decline reimbursement after a guild food shop purchase */
	GUILD_FOOD_SHOP_REIMBURSE_DECLINE: "GUILD_FOOD_SHOP_REIMBURSE_DECLINE",

	/** Custom ID used for the "stay in city" button across all city sub-menus */
	STAY_IN_CITY: "STAY_IN_CITY"
} as const;
