/** Mirrors `Lib/src/types/NotificationPreferences.ts`, kept in step by `WireEnums.test.ts`. */
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

export type NotificationPreferences = Record<NotificationType, boolean>;
