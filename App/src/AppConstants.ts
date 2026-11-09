export abstract class AppConstants {
	static readonly PACKET_TIMEOUT = 20000; // 20 seconds

	static readonly LEGAL_URLS = {
		PRIVACY: "https://crownicles.com/confidentialite/",
		TERMS: "https://crownicles.com/conditionsutilisation/"
	} as const;

	// Signs the images players share outside the app
	static readonly BRAND_NAME = "Crownicles";

	static readonly WEBSITE_HOST = "crownicles.com";

	// How long a cached entity is served without asking the server again, when no action invalidated it
	static readonly GAME_STATE_STALE_TIME = 30000; // 30 seconds

	// Quantities the guild food shop offers at a tap, as Discord does; the amount filling the storage is added to them
	static readonly GUILD_FOOD_QUICK_AMOUNTS = [
		1,
		10,
		100
	] as const;
}
