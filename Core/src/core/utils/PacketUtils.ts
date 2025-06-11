import {
	CrowniclesPacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	botConfig, mqttClient
} from "../../index";
import { AnnouncementPacket } from "../../../../Lib/src/packets/announcements/AnnouncementPacket";
import { NotificationPacket } from "../../../../Lib/src/packets/notifications/NotificationPacket";
import { NotificationsSerializedPacket } from "../../../../Lib/src/packets/notifications/NotificationsSerializedPacket";
import { MqttTopicUtils } from "../../../../Lib/src/utils/MqttTopicUtils";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

export abstract class PacketUtils {
	static sendPackets(context: PacketContext, packets: CrowniclesPacket[]): void {
		const responsePacket = {
			context,
			packets: packets.map(responsePacket => ({
				name: responsePacket.constructor.name,
				packet: responsePacket
			}))
		};

		const response = JSON.stringify(responsePacket);
		if (context.discord) {
			mqttClient.publish(MqttTopicUtils.getDiscordTopic(botConfig.PREFIX, context.discord.shardId), response);
			CrowniclesLogger.debug("Sent response to discord front", { response: responsePacket });
		}
		else if (context.webSocket) {
			mqttClient.publish(MqttTopicUtils.getWebSocketTopic(botConfig.PREFIX), response);
			CrowniclesLogger.debug("Sent response to web socket front", { response: responsePacket });
		}
		else {
			throw new Error("Unsupported platform");
		}
	}

	static announce(announcement: AnnouncementPacket, topic: string): void {
		const json = JSON.stringify(announcement);

		/*
		 * Retaining the message ensures that new subscribers will receive the announcement. So if the front is down, it will still receive the announcement when it comes back up.
		 * And if the MQTT server goes down, the announcement will still be available when it comes back up.
		 */
		mqttClient.publish(topic, json, { retain: true });
		CrowniclesLogger.debug("Sent Discord announcement", { json });
	}

	static isMqttConnected(): boolean {
		return mqttClient.connected;
	}

	static sendNotifications(notifications: NotificationPacket[]): void {
		const serializedPackets: NotificationsSerializedPacket = {
			notifications: notifications.map(notification => ({
				type: notification.constructor.name,
				packet: notification
			}))
		};
		const json = JSON.stringify(serializedPackets);
		mqttClient.publish(MqttTopicUtils.getNotificationsTopic(botConfig.PREFIX), json, {
			retain: true,
			qos: 2
		});
		CrowniclesLogger.debug("Sent notifications", { json });
	}
}
