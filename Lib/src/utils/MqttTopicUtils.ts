/**
 * Branded type for MQTT topic prefix to avoid primitive obsession
 * This provides type safety and ensures prefixes are validated before use
 */
export type MqttPrefix = string & { readonly __brand: "MqttPrefix" };

/**
 * Cast a raw string into the branded MqttPrefix type.
 * No runtime validation is performed — the branding is purely for compile-time safety.
 */
export function createMqttPrefix(prefix: string): MqttPrefix {
	return prefix as MqttPrefix;
}

export abstract class MqttTopicUtils {
	private static readonly CORE_TOPIC = "crownicles_core";

	private static readonly DISCORD_TOPIC = "crownicles_discord/shard";

	private static readonly DISCORD_TOP_WEEK_ANNOUNCEMENT_TOPIC = "crownicles_discord_top_week_announcement";

	private static readonly DISCORD_TOP_WEEK_FIGHT_ANNOUNCEMENT_TOPIC = "crownicles_discord_top_week_fight_announcement";

	private static readonly DISCORD_CHRISTMAS_BONUS_ANNOUNCEMENT_TOPIC = "crownicles_discord_christmas_bonus_announcement";

	private static readonly DISCORD_BLESSING_ANNOUNCEMENT_TOPIC = "crownicles_discord_blessing_announcement";

	private static readonly NOTIFICATIONS = "crownicles_notifications";

	private static readonly NOTIFICATIONS_CONSUMER = "notifications-consumer";

	private static readonly DISCORD_SHARD_MANAGER_TOPIC = "crownicles_shard_manager";

	private static readonly WEB_SOCKET_TOPIC = "crownicles_websocket";


	static getCoreTopic(prefix: MqttPrefix): string {
		return `${prefix}/${MqttTopicUtils.CORE_TOPIC}`;
	}

	static getDiscordTopic(prefix: MqttPrefix, shardId: number): string {
		return `${prefix}/${MqttTopicUtils.DISCORD_TOPIC}/${shardId}`;
	}

	static getDiscordTopWeekAnnouncementTopic(prefix: MqttPrefix): string {
		return `${prefix}/${MqttTopicUtils.DISCORD_TOP_WEEK_ANNOUNCEMENT_TOPIC}`;
	}

	static getDiscordTopWeekFightAnnouncementTopic(prefix: MqttPrefix): string {
		return `${prefix}/${MqttTopicUtils.DISCORD_TOP_WEEK_FIGHT_ANNOUNCEMENT_TOPIC}`;
	}

	static getDiscordChristmasBonusAnnouncementTopic(prefix: MqttPrefix): string {
		return `${prefix}/${MqttTopicUtils.DISCORD_CHRISTMAS_BONUS_ANNOUNCEMENT_TOPIC}`;
	}

	static getDiscordBlessingAnnouncementTopic(prefix: MqttPrefix): string {
		return `${prefix}/${MqttTopicUtils.DISCORD_BLESSING_ANNOUNCEMENT_TOPIC}`;
	}

	static getNotificationsTopic(prefix: MqttPrefix): string {
		return `${prefix}/${MqttTopicUtils.NOTIFICATIONS}`;
	}

	static getNotificationsConsumerId(prefix: MqttPrefix): string {
		return `${prefix}/${MqttTopicUtils.NOTIFICATIONS_CONSUMER}`;
	}

	static getDiscordShardManagerTopic(prefix: MqttPrefix): string {
		return `${prefix}/${MqttTopicUtils.DISCORD_SHARD_MANAGER_TOPIC}`;
	}

	static getWebSocketTopic(prefix: MqttPrefix): string {
		return `${prefix}/${MqttTopicUtils.WEB_SOCKET_TOPIC}`;
	}
}
