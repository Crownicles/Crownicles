import {Href} from "expo-router";
import {NOTIFICATION_TYPES, NotificationType} from "ws-packets/src/objects/NotificationPreferences";

/** Where a notification is carried in the data of a push, local or remote. */
export const NOTIFICATION_TYPE_KEY = "notificationType";

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
	[NOTIFICATION_TYPES.PET_EXPEDITION]: "/pet",
	[NOTIFICATION_TYPES.TOURNAMENT]: "/arena"
};

/** Every kind, in the order the settings list them. */
export const ALL_NOTIFICATION_TYPES: readonly NotificationType[] = Object.values(NOTIFICATION_TYPES);

export function isNotificationType(value: unknown): value is NotificationType {
	return typeof value === "string" && (ALL_NOTIFICATION_TYPES as readonly string[]).includes(value);
}
