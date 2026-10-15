import { MqttTopicUtils } from "../../../Lib/src/utils/MqttTopicUtils";
import { restWsConfig } from "../index";
import { RestWsMqttClient } from "./RestWsMqttClient";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import {
	CrowniclesPacket, PacketContext
} from "../../../Lib/src/packets/CrowniclesPacket";
import { WebSocketServer } from "../services/WebSocketServer";
import { getServerTranslator } from "../packets/fromServer/FromServerTranslator";
import { translateSmallEventResult } from "../packets/fromServer/translators/SmallEventResultServerTranslator";
import { SmallEventResultRes } from "../../../WsPackets/src/fromServer/smallEvents/SmallEventResultRes";
import { FromServerPacket } from "../../../WsPackets/src/fromServer/FromServerPacket";
import { MqttManager } from "./MqttManager";

/** A packet as Core publishes it for a WebSocket front. */
type CorePacket = {
	name: string;
	packet: CrowniclesPacket;
};

/** A packet as the app receives it, tied to the request it answers. */
type ClientPacket = {
	id?: string;
	name: string;
	packet: FromServerPacket;
};

/** Small events without a translator of their own all reach the app as one generic result. */
function isSmallEventResult(packetName: string): boolean {
	return packetName.startsWith("SmallEvent") && packetName.endsWith("Packet");
}

/**
 * The app form of a packet Core answered with, or null when nothing is to be sent: an awaited response or an untranslatable packet
 * @param context
 * @param corePacket
 */
async function translateForClient(context: PacketContext, corePacket: CorePacket): Promise<ClientPacket | null> {
	if (await MqttManager.asyncPacketSender.handleResponse(context, corePacket.name, corePacket.packet)) {
		return null;
	}
	const translator = getServerTranslator(corePacket.name);
	if (translator) {
		return {
			id: context.packetId,
			name: translator.protoName,
			packet: await translator.translatorFunc(context, corePacket.packet)
		};
	}
	if (isSmallEventResult(corePacket.name)) {
		return {
			id: context.packetId,
			name: SmallEventResultRes.wireName,
			packet: await translateSmallEventResult(corePacket.name, corePacket.packet)
		};
	}
	CrowniclesLogger.warn("No translator found for packet", { packet: corePacket });
	return null;
}

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
		const translatedPackets: ClientPacket[] = [];
		for (const packet of dataJson.packets as CorePacket[]) {
			const translated = await translateForClient(context, packet);
			if (translated) {
				translatedPackets.push(translated);
			}
		}

		// Core answers some requests with nothing, such as a device forgotten on behalf of a push service
		if (translatedPackets.length > 0) {
			WebSocketServer.dispatchPacketsToClient(context.keycloakId!, translatedPackets);
		}
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
