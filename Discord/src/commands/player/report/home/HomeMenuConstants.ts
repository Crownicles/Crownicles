/**
 * Constants for home menu IDs.
 * These are used as custom IDs for Discord select menus and buttons.
 */
export const HomeMenuIds = {
	/** Main home menu */
	MAIN_MENU: "HOME_MAIN_MENU",

	/** Home menu (navigation key) */
	HOME_MENU: "HOME_MENU",

	/** Manage home menu (notary) */
	MANAGE_HOME_MENU: "MANAGE_HOME_MENU",

	/** Option to leave the home and return to city */
	LEAVE_HOME: "LEAVE_HOME",

	/** Option to go back to the main home menu */
	BACK_TO_HOME: "BACK_TO_HOME",

	/** Upgrade station feature menu */
	UPGRADE_STATION: "HOME_UPGRADE_STATION"
} as const;

/**
 * Threshold for advanced upgrade level features.
 * Homes with maxItemUpgradeLevel >= this value get "advanced" description.
 */
export const ADVANCED_UPGRADE_LEVEL_THRESHOLD = 2;
