export const CITY_SERVICES = {
	BLACKSMITH: "blacksmith",
	ROYAL_BLACKSMITH: "royalBlacksmith",
	ENCHANTER: "enchanter",
	BOSS_ARCHIVIST: "bossArchivist"
} as const;

export type CityService = typeof CITY_SERVICES[keyof typeof CITY_SERVICES];
