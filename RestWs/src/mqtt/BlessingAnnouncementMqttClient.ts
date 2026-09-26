import { MqttTopicUtils } from "../../../Lib/src/utils/MqttTopicUtils";
import { BlessingAnnouncementPacket } from "../../../Lib/src/packets/announcements/BlessingAnnouncementPacket";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import { BlessingActivatedRes } from "../../../WsPackets/src/fromServer/character/BlessingActivatedRes";
import { restWsConfig } from "../index";
import { WebSocketServer } from "../services/WebSocketServer";
import { translateBlessingAnnouncement } from "../packets/fromServer/BlessingAnnouncement";
import { RestWsMqttClient } from "./RestWsMqttClient";

/**
 * Relays every blessing Core invokes to the players connected at that moment.
 */
export class BlessingAnnouncementMqttClient extends RestWsMqttClient {
	onConnect(): void {
		this.subscribeTo(this.mqttClient, MqttTopicUtils.getWebSocketBlessingAnnouncementTopic(restWsConfig.PREFIX), false);
	}

	onMessage(message: string): Promise<void> {
		const announcement = JSON.parse(message) as BlessingAnnouncementPacket;
		CrowniclesLogger.info("Relaying blessing to connected players", { blessingType: announcement.blessingType });
		WebSocketServer.broadcastPackets([
			{
				name: BlessingActivatedRes.wireName,
				packet: translateBlessingAnnouncement(announcement)
			}
		]);
		return Promise.resolve();
	}
}
