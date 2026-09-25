import { MqttConstants } from "../../../Lib/src/constants/MqttConstants";
import { GlobalMqttClient } from "./GlobalMqttClient";
import { BlessingAnnouncementMqttClient } from "./BlessingAnnouncementMqttClient";
import { restWsConfig } from "../index";

/**
 * Default MQTT client options
 */
const DEFAULT_MQTT_CLIENT_OPTIONS = {
	connectTimeout: MqttConstants.CONNECTION_TIMEOUT
};

/**
 * MQTT manager class
 */
export class MqttManager {
	/**
	 * Global MQTT client instance for communication with the backend
	 */
	static globalMqttClient: GlobalMqttClient;

	/**
	 * Relays blessings to every connected player
	 */
	static blessingAnnouncementMqttClient: BlessingAnnouncementMqttClient;

	/**
	 * Connects the MQTT clients
	 */
	static connectClients(): void {
		MqttManager.globalMqttClient = new GlobalMqttClient(restWsConfig.MQTT_HOST, DEFAULT_MQTT_CLIENT_OPTIONS);
		MqttManager.blessingAnnouncementMqttClient = new BlessingAnnouncementMqttClient(restWsConfig.MQTT_HOST, DEFAULT_MQTT_CLIENT_OPTIONS);
	}
}
