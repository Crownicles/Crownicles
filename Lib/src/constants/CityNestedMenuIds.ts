/**
 * Identifiers of city service menus on the Discord side that Core can open through
 * the `initialMenu` field of {@link ReactionCollectorCityData}.
 */
export const CityNestedMenuIds = {
	BLACKSMITH: "BLACKSMITH_MENU",
	ROYAL_BLACKSMITH: "ROYAL_BLACKSMITH_MENU",
	ENCHANTER: "ENCHANTER_MENU"
} as const;

export type CityNestedMenuId = typeof CityNestedMenuIds[keyof typeof CityNestedMenuIds];
