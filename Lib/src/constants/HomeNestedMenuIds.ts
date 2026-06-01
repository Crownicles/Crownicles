/**
 * Identifiers for nested menus on the Discord side that are also referenced
 * from Core via the `initialMenu` field of {@link ReactionCollectorCityData}.
 *
 * These IDs are part of the cross-service contract: Core sets `initialMenu`
 * to one of these values, and Discord must register a menu with the matching ID.
 */
export const HomeNestedMenuIds = {
	GARDEN: "HOME_GARDEN_MENU"
} as const;

export type HomeNestedMenuId = typeof HomeNestedMenuIds[keyof typeof HomeNestedMenuIds];
