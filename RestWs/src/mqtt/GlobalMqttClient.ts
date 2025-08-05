import { MqttTopicUtils } from "../../../Lib/src/utils/MqttTopicUtils";
import { restWsConfig } from "../index";
import { RestWsMqttClient } from "./RestWsMqttClient";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import {
	CrowniclesPacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { WebSocketServer } from "../services/WebSocketServer";
import { getServerTranslator } from "../packets/fromServer/FromServerTranslator";

/**
 * Global MQTT client class for communication with the backend
 */
export class GlobalMqttClient extends RestWsMqttClient {
	/**
	 * MQTT topic for the core topic
	 */
	private readonly coreTopic = MqttTopicUtils.getCoreTopic(restWsConfig.PREFIX);

	/**
	 * Function called when the client is connected to the MQTT broker
	 */
	onConnect(): void {
		this.subscribeTo(this.mqttClient, MqttTopicUtils.getWebSocketTopic(restWsConfig.PREFIX), true);
	}

	/**
	 * Function called when a message is received from the MQTT broker
	 * @param message
	 */
	async onMessage(message: string): Promise<void> {
		const dataJson = JSON.parse(message);
		CrowniclesLogger.debug("Received global message", { packet: dataJson });

		if (!Object.hasOwn(dataJson, "packets") || !Object.hasOwn(dataJson, "context")) {
			CrowniclesLogger.error("Wrong packet format", { packet: message });
		}

		const context = dataJson.context as PacketContext;

		// Translate the packets to the client format
		const translatedPackets = [];
		for (const packet of dataJson.packets) {
			const translator = getServerTranslator(packet.name);
			if (!translator) {
				CrowniclesLogger.warn("No translator found for packet", { packet });
				continue;
			}
			translatedPackets.push({
				id: context.packetId,
				name: translator.protoName,
				packet: await translator.translatorFunc(context, packet.packet)
			});
		}

		WebSocketServer.dispatchPacketsToClient(context.keycloakId!, translatedPackets);
	}

	/**
	 * Send a packet to the backend
	 * @param context
	 * @param packet
	 */
	public sendToBackEnd(context: PacketContext, packet: CrowniclesPacket): void {
		const toSend = {
			packet: {
				name: packet.constructor.name,
				data: packet
			},
			context
		};
		this.mqttClient.publish(this.coreTopic, JSON.stringify(toSend));
		CrowniclesLogger.debug("Sent message to backend", toSend);
	}
}
