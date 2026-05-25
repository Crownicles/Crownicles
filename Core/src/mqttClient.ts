import { connect } from "mqtt";
import { botConfig } from "./bootstrap";
import { MqttConstants } from "../../Lib/src/constants/MqttConstants";

export const mqttClient = connect(botConfig.MQTT_HOST, {
	connectTimeout: MqttConstants.CONNECTION_TIMEOUT
});
