import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { botConfig } from "../../bootstrap";
import { mqttClient } from "../../mqttClient";
import { AnnouncementPacket } from "../../../../Lib/src/packets/announcements/AnnouncementPacket";
import { NotificationPacket } from "../../../../Lib/src/packets/notifications/NotificationPacket";
import { NotificationsSerializedPacket } from "../../../../Lib/src/packets/notifications/NotificationsSerializedPacket";
import { PlayerDeathPacket } from "../../../../Lib/src/packets/events/PlayerDeathPacket";
import { MqttTopicUtils } from "../../../../Lib/src/utils/MqttTopicUtils";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { ErrorInternalPacket } from "../../../../Lib/src/packets/commands/ErrorPacket";

export type InternalErrorDetails = {

	/**
	 * The caught exception, when the failure comes from one
	 */
	cause?: unknown;

	/**
	 * Identifiers pinpointing the failure. Logged server-side only: the reason is echoed in a public
	 * Discord message, so nothing identifying a player may travel with it.
	 */
	context?: Record<string, unknown>;
};

export abstract class PacketUtils {
	/**
	 * Report a failure the player can do nothing about. The reason describes what went wrong and is shown to the
	 * player so they can write a useful bug report, while the caught exception is only logged server-side (CWE-209).
	 * @param response
	 * @param reason
	 * @param details Server-side only information about the failure
	 */
	static pushInternalError(response: CrowniclesPacket[], reason: string, details: InternalErrorDetails = {}): void {
		if (details.cause === undefined) {
			CrowniclesLogger.error(reason, details.context);
		}
		else {
			CrowniclesLogger.errorWithObj(reason, {
				cause: details.cause,
				...details.context
			});
		}
		response.push(makePacket(ErrorInternalPacket, { reason }));
	}

	/**
	 * The death of a player is detected as soon as their health reaches 0, which can happen in the middle of a flow
	 * (e.g. before the outcome of a big event has been described). Sending the death packets last keeps the kill
	 * check on the only chokepoint that cannot be forgotten while preserving a readable order for the player.
	 * @param packets
	 */
	private static moveDeathPacketsLast(packets: CrowniclesPacket[]): CrowniclesPacket[] {
		const deathPackets = packets.filter(packet => packet instanceof PlayerDeathPacket);
		if (deathPackets.length === 0) {
			return packets;
		}

		return [
			...packets.filter(packet => !(packet instanceof PlayerDeathPacket)),
			...deathPackets
		];
	}

	static sendPackets(context: PacketContext, packets: CrowniclesPacket[]): void {
		const responsePacket = {
			context,
			packets: PacketUtils.moveDeathPacketsLast(packets)
				.map(responsePacket => ({
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
