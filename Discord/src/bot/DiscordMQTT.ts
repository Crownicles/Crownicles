import {
	crowniclesClient, discordConfig, shardId
} from "./CrowniclesShard";
import { PacketListenerClient } from "../../../Lib/src/packets/PacketListener";
import { registerAllPacketHandlers } from "../packetHandlers/PacketHandler";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { ErrorPacket } from "../../../Lib/src/packets/commands/ErrorPacket";
import {
	connect, MqttClient
} from "mqtt";
import { MqttConstants } from "../../../Lib/src/constants/MqttConstants";
import { DiscordAnnouncement } from "../announcements/DiscordAnnouncement";
import { NotificationsHandler } from "../notifications/NotificationsHandler";
import { NotificationsSerializedPacket } from "../../../Lib/src/packets/notifications/NotificationsSerializedPacket";
import { LANGUAGE } from "../../../Lib/src/Language";
import { TextChannel } from "discord.js";
import { CrowniclesEmbed } from "../messages/CrowniclesEmbed";
import i18n from "../translations/i18n";
import { MqttTopicUtils } from "../../../Lib/src/utils/MqttTopicUtils";
import { CrowniclesDiscordMetrics } from "./CrowniclesDiscordMetrics";
import { millisecondsToSeconds } from "../../../Lib/src/utils/TimeUtils";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { AsyncCorePacketSender } from "./AsyncCorePacketSender";
import { DiscordConstants } from "../DiscordConstants";
import { CommandTestListPacketReq } from "../../../Lib/src/packets/commands/CommandTestListPacket";
import { PacketUtils } from "../utils/PacketUtils";

const DEFAULT_MQTT_CLIENT_OPTIONS = {
	connectTimeout: MqttConstants.CONNECTION_TIMEOUT
};

export class DiscordMQTT {
	static globalMqttClient: MqttClient;

	static notificationMqttClient: MqttClient;

	static topWeekAnnouncementMqttClient: MqttClient;

	static topWeekFightAnnouncementMqttClient: MqttClient;

	static packetListener: PacketListenerClient = new PacketListenerClient();

	static asyncPacketSender: AsyncCorePacketSender = new AsyncCorePacketSender();

	static async init(isMainShard: boolean): Promise<void> {
		await registerAllPacketHandlers();

		this.connectSubscribeAndHandleGlobal();
		this.connectSubscribeAndHandleTopWeekAnnouncement();
		this.connectSubscribeAndHandleTopWeekFightAnnouncement();

		if (isMainShard) {
			this.connectSubscribeAndHandleNotifications();
			this.requestTestCommandsList();
		}
	}

	/**
	 * Request the list of test commands from Core for autocomplete
	 */
	private static requestTestCommandsList(): void {
		try {
			const packet = makePacket(CommandTestListPacketReq, {});
			const context: PacketContext = {
				frontEndOrigin: "discord",
				frontEndSubOrigin: "system",
				discord: {
					shardId,
					user: "",
					interaction: "",
					channel: "",
					language: LANGUAGE.ENGLISH
				}
			};
			PacketUtils.sendPacketToBackend(context, packet);
			CrowniclesLogger.info("Requested test commands list from Core");
		}
		catch (error) {
			CrowniclesLogger.errorWithObj("Failed to request test commands list", error);
		}
	}

	/**
	 * Handles the duplicated shard message.
	 * This function is called when a shard receives a message from another shard with the same ID.
	 * When this happens, the shard will disconnect from all MQTT topics and Discord to avoid duplication.
	 * It will also publish a message to the shard manager to inform it that it is duplicated, so the
	 * shard manager can kill all shards with this ID to clean everything up.
	 * @param messageString
	 */
	private static async handleDuplicatedShardMessage(messageString: string): Promise<void> {
		let messageParts = messageString.split(":");
		if (messageParts.length !== 2) {
			// Shouldn't happen
			CrowniclesLogger.error("Wrong shard connection message format. Disconnecting anyway.", { receivedMessage: messageString });
			messageParts = [DiscordConstants.MQTT.SHARD_CONNECTION_MSG, process.pid.toString()];
		}
		if (messageParts[1] !== process.pid.toString()) {
			CrowniclesLogger.warn("Received shard connection message from another process, this process will now disconnect from all MQTT topics and Discord to avoid duplication", {
				receivedFromPid: messageParts[1],
				pid: process.pid
			});
			try {
				DiscordMQTT.globalMqttClient.publish(MqttTopicUtils.getDiscordShardManagerTopic(discordConfig.PREFIX), `${DiscordConstants.MQTT.SHARD_DUPLICATED_MSG}${shardId}`);
				CrowniclesLogger.warn("Published shard duplication message to shard manager");
			}
			catch (error) {
				CrowniclesLogger.errorWithObj("Error while publishing shard duplication message to shard manager", error);
			}
			try {
				await crowniclesClient.destroy();
				CrowniclesLogger.warn("Disconnected from Discord");
			}
			catch (error) {
				CrowniclesLogger.errorWithObj("Error while disconnecting from Discord", error);
			}
			try {
				DiscordMQTT.globalMqttClient.unsubscribe(MqttTopicUtils.getDiscordTopic(discordConfig.PREFIX, shardId));
				DiscordMQTT.globalMqttClient.end();
				CrowniclesLogger.warn("Disconnected from global MQTT client");
			}
			catch (error) {
				CrowniclesLogger.errorWithObj("Error while disconnecting global MQTT client", error);
			}
			try {
				DiscordMQTT.notificationMqttClient.unsubscribe(MqttTopicUtils.getNotificationsTopic(discordConfig.PREFIX));
				DiscordMQTT.notificationMqttClient.end();
				CrowniclesLogger.warn("Disconnected from notification MQTT client");
			}
			catch (error) {
				CrowniclesLogger.errorWithObj("Error while disconnecting notification MQTT client", error);
			}
			try {
				DiscordMQTT.topWeekAnnouncementMqttClient.unsubscribe(MqttTopicUtils.getDiscordTopWeekAnnouncementTopic(discordConfig.PREFIX));
				DiscordMQTT.topWeekAnnouncementMqttClient.end();
				CrowniclesLogger.warn("Disconnected from top week announcement MQTT client");
			}
			catch (error) {
				CrowniclesLogger.errorWithObj("Error while disconnecting top week announcement MQTT client", error);
			}
			try {
				DiscordMQTT.topWeekFightAnnouncementMqttClient.unsubscribe(MqttTopicUtils.getDiscordTopWeekFightAnnouncementTopic(discordConfig.PREFIX));
				DiscordMQTT.topWeekFightAnnouncementMqttClient.end();
				CrowniclesLogger.warn("Disconnected from top week fight announcement MQTT client");
			}
			catch (error) {
				CrowniclesLogger.errorWithObj("Error while disconnecting top week fight announcement MQTT client", error);
			}
		}
	}

	/**
	 * Handles the global MQTT packets message.
	 * This function is called when a message is received from the global MQTT topic.
	 * It will parse the message and call the appropriate packet listeners.
	 * @param messageString
	 */
	private static async handleGlobalMqttPacketsMessage(messageString: string): Promise<void> {
		const dataJson = JSON.parse(messageString);
		CrowniclesLogger.debug("Received global message", { packet: dataJson });
		if (!Object.hasOwn(dataJson, "packets") || !Object.hasOwn(dataJson, "context")) {
			CrowniclesLogger.error("Wrong packet format", { packet: messageString });
			return;
		}

		const context = dataJson.context as PacketContext;

		for (const packet of dataJson.packets) {
			try {
				CrowniclesDiscordMetrics.incrementPacketCount(packet.name);

				if (await DiscordMQTT.asyncPacketSender.handleResponse(context, packet.name, packet.packet)) {
					continue;
				}

				let listener = DiscordMQTT.packetListener.getListener(packet.name);
				if (!listener) {
					packet.packet = makePacket(ErrorPacket, { message: `No packet listener found for received packet '${packet.name}'.\n\nData:\n${JSON.stringify(packet.packet)}` });
					listener = DiscordMQTT.packetListener.getListener("ErrorPacket")!;
				}
				const startTime = Date.now();
				await listener(context as PacketContext, packet.packet as CrowniclesPacket);
				CrowniclesDiscordMetrics.observePacketTime(packet.name, millisecondsToSeconds(Date.now() - startTime));
			}
			catch (error) {
				CrowniclesLogger.errorWithObj("Error while handling packet", error);
				CrowniclesDiscordMetrics.incrementPacketErrorCount(packet.name);

				const context = dataJson.context as PacketContext;
				const lng = context.discord?.language ?? LANGUAGE.ENGLISH;
				if (context.discord?.channel) {
					const channel = await crowniclesClient.channels.fetch(context.discord.channel);
					if (channel instanceof TextChannel) {
						await channel.send({ embeds: [
							new CrowniclesEmbed()
								.setErrorColor()
								.setTitle(i18n.t("error:errorOccurredTitle", { lng }))
								.setDescription(i18n.t("error:errorOccurred", { lng }))
						] });
					}
				}
			}
		}
	}

	private static handleGlobalMqttMessage(): void {
		DiscordMQTT.globalMqttClient.on("message", async (_topic, message) => {
			const messageString = message.toString();
			if (messageString === "") {
				return;
			}

			if (messageString.startsWith(DiscordConstants.MQTT.SHARD_CONNECTION_MSG)) {
				await DiscordMQTT.handleDuplicatedShardMessage(messageString);
				return;
			}

			await DiscordMQTT.handleGlobalMqttPacketsMessage(messageString);
		});
	}

	private static handleTopWeekAnnouncementMqttMessage(): void {
		DiscordMQTT.topWeekAnnouncementMqttClient.on("message", async (_topic, message) => {
			if (message.toString() === "") {
				CrowniclesLogger.debug("No top week announcement in the MQTT topic");
				return;
			}

			if (await DiscordAnnouncement.canAnnounce()) {
				await DiscordAnnouncement.announceTopWeek(JSON.parse(message.toString()));

				// Clear the announcement so it doesn't get processed again
				DiscordMQTT.topWeekAnnouncementMqttClient.publish(MqttTopicUtils.getDiscordTopWeekAnnouncementTopic(discordConfig.PREFIX), "", { retain: true });
			}
		});
	}

	private static handleTopWeekFightAnnouncementMqttMessage(): void {
		DiscordMQTT.topWeekFightAnnouncementMqttClient.on("message", async (_topic, message) => {
			if (message.toString() === "") {
				CrowniclesLogger.debug("No top week fight announcement in the MQTT topic");
				return;
			}

			if (await DiscordAnnouncement.canAnnounce()) {
				await DiscordAnnouncement.announceTopWeekFight(JSON.parse(message.toString()));

				// Clear the announcement so it doesn't get processed again
				DiscordMQTT.topWeekFightAnnouncementMqttClient.publish(MqttTopicUtils.getDiscordTopWeekFightAnnouncementTopic(discordConfig.PREFIX), "", { retain: true });
			}
		});
	}

	private static handleNotificationMqttMessage(): void {
		DiscordMQTT.notificationMqttClient.on("message", (_topic, message) => {
			if (message.toString() === "") {
				return;
			}

			const messageString = message.toString();

			const serializedPacket: NotificationsSerializedPacket = JSON.parse(messageString);
			CrowniclesLogger.debug("Received notification message", { packet: serializedPacket });
			NotificationsHandler.sendNotifications(serializedPacket);
		});
	}

	private static subscribeTo(mqttClient: MqttClient, topic: string, cleanBefore: boolean): void {
		if (cleanBefore) {
			mqttClient.publish(topic, "", { retain: true }); // Clear the last message to avoid processing it twice
		}

		mqttClient.subscribe(topic, err => {
			if (err) {
				CrowniclesLogger.errorWithObj(`Error while subscribing to topic ${topic}`, err);
				process.exit(1);
			}
			else {
				CrowniclesLogger.info(`Subscribed to topic ${topic}`);
			}
		});
	}

	private static connectSubscribeAndHandleGlobal(): void {
		DiscordMQTT.globalMqttClient = connect(discordConfig.MQTT_HOST, DEFAULT_MQTT_CLIENT_OPTIONS);

		DiscordMQTT.globalMqttClient.on("connect", () => {
			const discordTopic = MqttTopicUtils.getDiscordTopic(discordConfig.PREFIX, shardId);
			DiscordMQTT.globalMqttClient.publish(discordTopic, `${DiscordConstants.MQTT.SHARD_CONNECTION_MSG}${process.pid}`);
			DiscordMQTT.subscribeTo(DiscordMQTT.globalMqttClient, discordTopic, true);
		});

		this.handleGlobalMqttMessage();
	}

	private static connectSubscribeAndHandleTopWeekAnnouncement(): void {
		DiscordMQTT.topWeekAnnouncementMqttClient = connect(discordConfig.MQTT_HOST, DEFAULT_MQTT_CLIENT_OPTIONS);

		DiscordMQTT.topWeekAnnouncementMqttClient.on("connect", () => {
			DiscordMQTT.subscribeTo(DiscordMQTT.topWeekAnnouncementMqttClient, MqttTopicUtils.getDiscordTopWeekAnnouncementTopic(discordConfig.PREFIX), false);
		});

		this.handleTopWeekAnnouncementMqttMessage();
	}

	private static connectSubscribeAndHandleTopWeekFightAnnouncement(): void {
		DiscordMQTT.topWeekFightAnnouncementMqttClient = connect(discordConfig.MQTT_HOST, DEFAULT_MQTT_CLIENT_OPTIONS);

		DiscordMQTT.topWeekFightAnnouncementMqttClient.on("connect", () => {
			DiscordMQTT.subscribeTo(DiscordMQTT.topWeekFightAnnouncementMqttClient, MqttTopicUtils.getDiscordTopWeekFightAnnouncementTopic(discordConfig.PREFIX), false);
		});

		this.handleTopWeekFightAnnouncementMqttMessage();
	}

	private static connectSubscribeAndHandleNotifications(): void {
		DiscordMQTT.notificationMqttClient = connect(discordConfig.MQTT_HOST, {
			...DEFAULT_MQTT_CLIENT_OPTIONS,
			clientId: MqttTopicUtils.getNotificationsConsumerId(discordConfig.PREFIX),
			clean: false // Keeps session active even if the client goes offline
		});

		DiscordMQTT.notificationMqttClient.on("connect", () => {
			DiscordMQTT.subscribeTo(DiscordMQTT.notificationMqttClient, MqttTopicUtils.getNotificationsTopic(discordConfig.PREFIX), true);
		});

		this.handleNotificationMqttMessage();
	}
}

