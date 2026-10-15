/** Every kind of notification a player can receive, keyed like the Discord `/notifications` settings. */
export const NOTIFICATION_TYPES = {
	REPORT: "report",
	DAILY_BONUS: "dailyBonus",
	ENERGY: "energy",
	GUILD_DAILY: "guildDaily",
	GUILD_KICK: "guildKick",
	GUILD_STATUS_CHANGE: "guildStatusChange",
	PLAYER_FREED_FROM_JAIL: "playerFreedFromJail",
	FIGHT_CHALLENGE: "fightChallenge",
	PET_EXPEDITION: "petExpedition",
	TOURNAMENT: "tournament"
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

export const ALL_NOTIFICATION_TYPES: readonly NotificationType[] = Object.values(NOTIFICATION_TYPES);

/** Whether each kind of notification is wanted. */
export type NotificationPreferences = Record<NotificationType, boolean>;

/** A new player wants every notification, as on Discord. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = Object.fromEntries(
	ALL_NOTIFICATION_TYPES.map(type => [type, true])
) as NotificationPreferences;

export function isNotificationType(value: unknown): value is NotificationType {
	return typeof value === "string" && (ALL_NOTIFICATION_TYPES as readonly string[]).includes(value);
}

/** What Core asks Discord for, the first time a player opens the app's notification settings. */
export type DiscordNotificationPreferencesRequest = { keycloakId: string };
