import {
	describe, expect, it
} from "vitest";
import {
	createMqttPrefix, MqttPrefix, MqttTopicUtils
} from "../../src/utils/MqttTopicUtils";

/*
 * The topics are the wire contract between the Core, the Discord shards and the websocket service:
 * a service deployed with another version must keep subscribing to the same paths.
 */
describe("MqttTopicUtils", () => {
	it.each([
		["core", (prefix: MqttPrefix): string => MqttTopicUtils.getCoreTopic(prefix), "prod/crownicles_core"],
		["discord shard", (prefix: MqttPrefix): string => MqttTopicUtils.getDiscordTopic(prefix, 3), "prod/crownicles_discord/shard/3"],
		["top week", (prefix: MqttPrefix): string => MqttTopicUtils.getDiscordTopWeekAnnouncementTopic(prefix), "prod/crownicles_discord_top_week_announcement"],
		["top week fight", (prefix: MqttPrefix): string => MqttTopicUtils.getDiscordTopWeekFightAnnouncementTopic(prefix), "prod/crownicles_discord_top_week_fight_announcement"],
		["christmas bonus", (prefix: MqttPrefix): string => MqttTopicUtils.getDiscordChristmasBonusAnnouncementTopic(prefix), "prod/crownicles_discord_christmas_bonus_announcement"],
		["release gift", (prefix: MqttPrefix): string => MqttTopicUtils.getDiscordReleaseGiftAnnouncementTopic(prefix), "prod/crownicles_discord_release_gift_announcement"],
		["blessing", (prefix: MqttPrefix): string => MqttTopicUtils.getDiscordBlessingAnnouncementTopic(prefix), "prod/crownicles_discord_blessing_announcement"],
		["notifications", (prefix: MqttPrefix): string => MqttTopicUtils.getNotificationsTopic(prefix), "prod/crownicles_notifications"],
		["notifications consumer", (prefix: MqttPrefix): string => MqttTopicUtils.getNotificationsConsumerId(prefix), "prod/notifications-consumer"],
		["shard manager", (prefix: MqttPrefix): string => MqttTopicUtils.getDiscordShardManagerTopic(prefix), "prod/crownicles_shard_manager"],
		["websocket", (prefix: MqttPrefix): string => MqttTopicUtils.getWebSocketTopic(prefix), "prod/crownicles_websocket"]
	])("builds the %s topic under the prefix", (_name, topicOf, expected) => {
		expect(topicOf(createMqttPrefix("prod"))).toBe(expected);
	});
});
