import {
	Href, useRouter
} from "expo-router";

type Router = ReturnType<typeof useRouter>;
import {
	NOTIFICATION_TYPES, NotificationType
} from "ws-packets/src/objects/NotificationPreferences";

/** Where a notification is carried in the data of a push, local or remote. */
export const NOTIFICATION_TYPE_KEY = "notificationType";

export const LEGACY_TRAVEL_NOTIFICATION_ID = "report-ready";

/** The screen each kind of notification opens when tapped: the place where the player can act on it. */
export const NOTIFICATION_ROUTES: Record<NotificationType, Href> = {
	[NOTIFICATION_TYPES.REPORT]: "/",
	[NOTIFICATION_TYPES.DAILY_BONUS]: "/profile/inventory",
	[NOTIFICATION_TYPES.ENERGY]: "/arena",
	[NOTIFICATION_TYPES.GUILD_DAILY]: "/guild",
	[NOTIFICATION_TYPES.GUILD_KICK]: "/guild",
	[NOTIFICATION_TYPES.GUILD_STATUS_CHANGE]: "/guild",
	[NOTIFICATION_TYPES.PLAYER_FREED_FROM_JAIL]: "/",
	[NOTIFICATION_TYPES.FIGHT_CHALLENGE]: "/arena/history",
	[NOTIFICATION_TYPES.PET_EXPEDITION]: "/pet"
};

/**
 * Opens the screen of a notification with the home of its tab under it (the `anchor` of the tab's
 * stack): back then returns to that home rather than to another tab, and the tab is not stuck on the sub-page.
 */
export function openNotificationRoute(router: Router, type: NotificationType): void {
	router.navigate(NOTIFICATION_ROUTES[type], { withAnchor: true });
}

/** Every kind, in the order the settings list them. */
export const ALL_NOTIFICATION_TYPES: readonly NotificationType[] = Object.values(NOTIFICATION_TYPES);

export function isNotificationType(value: unknown): value is NotificationType {
	return typeof value === "string" && (ALL_NOTIFICATION_TYPES as readonly string[]).includes(value);
}
