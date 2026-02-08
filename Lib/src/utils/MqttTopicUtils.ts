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


	static getCoreTopic(prefix: string): string {
		return `${prefix}/${MqttTopicUtils.CORE_TOPIC}`;
	}

	static getDiscordTopic(prefix: string, shardId: number): string {
		return `${prefix}/${MqttTopicUtils.DISCORD_TOPIC}/${shardId}`;
	}

	static getDiscordTopWeekAnnouncementTopic(prefix: string): string {
		return `${prefix}/${MqttTopicUtils.DISCORD_TOP_WEEK_ANNOUNCEMENT_TOPIC}`;
	}

	static getDiscordTopWeekFightAnnouncementTopic(prefix: string): string {
		return `${prefix}/${MqttTopicUtils.DISCORD_TOP_WEEK_FIGHT_ANNOUNCEMENT_TOPIC}`;
	}

	static getDiscordChristmasBonusAnnouncementTopic(prefix: string): string {
		return `${prefix}/${MqttTopicUtils.DISCORD_CHRISTMAS_BONUS_ANNOUNCEMENT_TOPIC}`;
	}

	static getDiscordBlessingAnnouncementTopic(prefix: string): string {
		return `${prefix}/${MqttTopicUtils.DISCORD_BLESSING_ANNOUNCEMENT_TOPIC}`;
	}

	static getNotificationsTopic(prefix: string): string {
		return `${prefix}/${MqttTopicUtils.NOTIFICATIONS}`;
	}

	static getNotificationsConsumerId(prefix: string): string {
		return `${prefix}/${MqttTopicUtils.NOTIFICATIONS_CONSUMER}`;
	}

	static getDiscordShardManagerTopic(prefix: string): string {
		return `${prefix}/${MqttTopicUtils.DISCORD_SHARD_MANAGER_TOPIC}`;
	}

	static getWebSocketTopic(prefix: string): string {
		return `${prefix}/${MqttTopicUtils.WEB_SOCKET_TOPIC}`;
	}
}
