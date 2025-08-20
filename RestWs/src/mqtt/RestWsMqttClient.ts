import {
	connect, IClientOptions, MqttClient
} from "mqtt";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";

/**
 * Abstract class for a MQTT client
 */
export abstract class RestWsMqttClient {
	/**
	 * MQTT client instance
	 */
	protected mqttClient: MqttClient;

	/**
	 * Constructor
	 * @param host MQTT broker host
	 * @param options MQTT client options
	 */
	public constructor(host: string, options: IClientOptions) {
		this.mqttClient = connect(host, options);

		this.mqttClient.on("connect", () => {
			CrowniclesLogger.info("Connected to MQTT broker");
			this.onConnect();
		});

		this.mqttClient.on("message", async (_topic, message) => {
			try {
				const messageString = message.toString();
				if (messageString === "") {
					return;
				}

				await this.onMessage(messageString);
			}
			catch (e) {
				CrowniclesLogger.errorWithObj("Error while processing MQTT message", e);
			}
		});
	}

	/**
	 * Subscribe to a topic
	 * @param mqttClient MQTT client instance
	 * @param topic Topic to subscribe to
	 * @param cleanBefore Whether to clear the last message before subscribing
	 */
	protected subscribeTo(mqttClient: MqttClient, topic: string, cleanBefore: boolean): void {
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

	/**
	 * Function to be called when the client is connected to the MQTT broker
	 */
	abstract onConnect(): void;

	/**
	 * Function to be called when a message is received
	 * @param message
	 */
	abstract onMessage(message: string): Promise<void>;
}
