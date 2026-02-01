import { Crownicles } from "./core/bot/Crownicles";
import { loadConfig } from "./core/bot/CrowniclesConfig";
import {
	CrowniclesPacket, makePacket, PacketContext, PacketLike
} from "../../Lib/src/packets/CrowniclesPacket";
import {
	ErrorMaintenancePacket,
	ErrorPacket,
	ErrorResetIsNow,
	ErrorSeasonEndIsNow
} from "../../Lib/src/packets/commands/ErrorPacket";
import { connect } from "mqtt";
import { PacketUtils } from "./core/utils/PacketUtils";
import { MqttConstants } from "../../Lib/src/constants/MqttConstants";
import { RightGroup } from "../../Lib/src/types/RightGroup";
import { MqttTopicUtils } from "../../Lib/src/utils/MqttTopicUtils";
import { CrowniclesCoreMetrics } from "./core/bot/CrowniclesCoreMetrics";
import {
	millisecondsToSeconds, resetIsNow, seasonEndIsNow
} from "../../Lib/src/utils/TimeUtils";
import { CrowniclesLogger } from "../../Lib/src/logs/CrowniclesLogger";
import "source-map-support/register";
import { CoreConstants } from "./core/CoreConstants";

process.on("uncaughtException", error => {
	console.error(`Uncaught exception: ${error}`);
	if (CrowniclesLogger.isInitialized()) {
		CrowniclesLogger.errorWithObj("Uncaught exception", error);
	}
});

process.on("unhandledRejection", error => {
	console.error(`Unhandled rejection: ${error}`);
	if (CrowniclesLogger.isInitialized()) {
		CrowniclesLogger.errorWithObj("Unhandled rejection", error);
	}
});

export const botConfig = loadConfig();
CrowniclesLogger.init(botConfig.LOG_LEVEL, botConfig.LOG_LOCATIONS, { app: "Core" }, botConfig.LOKI_HOST
	? {
		host: botConfig.LOKI_HOST,
		username: botConfig.LOKI_USERNAME,
		password: botConfig.LOKI_PASSWORD
	}
	: undefined);
export let crowniclesInstance: Crownicles | null = null;

CrowniclesLogger.info(`${CoreConstants.OPENING_LINE} - ${process.env.npm_package_version}`);

export const mqttClient = connect(botConfig.MQTT_HOST, {
	connectTimeout: MqttConstants.CONNECTION_TIMEOUT
});

mqttClient.on("connect", () => {
	mqttClient.subscribe(MqttTopicUtils.getCoreTopic(botConfig.PREFIX), err => {
		if (err) {
			CrowniclesLogger.errorWithObj("Error while subscribing to MQTT topic", err);
			process.exit(1);
		}
		else {
			CrowniclesLogger.info("Connected to MQTT");
		}
	});
});

function globalStopOfPlayers(response: CrowniclesPacket[], dataJson: {
	context: PacketContext; packet: PacketLike<CrowniclesPacket>;
}): boolean {
	if (
		botConfig.MODE_MAINTENANCE
		&& !CoreConstants.BYPASS_MAINTENANCE_AND_RESETS_PACKETS.includes(dataJson.packet.name)
		&& !(dataJson.context as PacketContext).rightGroups?.includes(RightGroup.MAINTENANCE)
		&& !(dataJson.context as PacketContext).rightGroups?.includes(RightGroup.ADMIN)
	) {
		response.push(makePacket(ErrorMaintenancePacket, {}));
		return true;
	}
	if (resetIsNow()
		&& !CoreConstants.BYPASS_MAINTENANCE_AND_RESETS_PACKETS.includes(dataJson.packet.name)
	) {
		response.push(makePacket(ErrorResetIsNow, {}));
		return true;
	}
	if (false && seasonEndIsNow()
		&& !CoreConstants.BYPASS_MAINTENANCE_AND_RESETS_PACKETS.includes(dataJson.packet.name)) {
		response.push(makePacket(ErrorSeasonEndIsNow, {}));
		return true;
	}
	return false;
}

mqttClient.on("message", async (topic, message) => {
	const messageString = message.toString();
	const dataJson = JSON.parse(messageString);
	CrowniclesLogger.debug(`Received message from topic ${topic}`, { packet: dataJson });
	if (!Object.hasOwn(dataJson, "packet") || !Object.hasOwn(dataJson, "context")) {
		CrowniclesLogger.error("Wrong packet format", { packet: messageString });
		return;
	}
	const response: CrowniclesPacket[] = [];
	const context: PacketContext = dataJson.context;

	if (!crowniclesInstance) {
		CrowniclesLogger.error("Crownicles instance not initialized");
		return;
	}

	if (!globalStopOfPlayers(response, dataJson)) {
		const listener = crowniclesInstance.packetListener.getListener(dataJson.packet.name);
		if (!listener) {
			const errorMessage = `No listener found for packet '${dataJson.packet.name}'`;
			CrowniclesLogger.error(errorMessage);
			response.push(makePacket(ErrorPacket, { message: errorMessage }));
		}
		else {
			if (context.keycloakId) {
				crowniclesInstance?.logsDatabase.logCommandUsage(context.keycloakId, context.frontEndOrigin, context.frontEndSubOrigin, dataJson.packet.name)
					.then();
			}
			else {
				CrowniclesLogger.debug(`Skipping command usage logging for packet '${dataJson.packet.name}' without keycloakId`, { context });
			}
			CrowniclesCoreMetrics.incrementPacketCount(dataJson.packet.name);
			const startTime = Date.now();
			try {
				await listener(response, context, dataJson.packet.data);
			}
			catch (error: unknown) {
				CrowniclesLogger.errorWithObj(`Error while processing packet '${dataJson.packet.name}'`, error);
				response.push(makePacket(ErrorPacket, { message: error instanceof Error ? error.message : String(error) }));
				CrowniclesCoreMetrics.incrementPacketErrorCount(dataJson.packet.name);
			}
			CrowniclesCoreMetrics.observePacketTime(dataJson.packet.name, millisecondsToSeconds(Date.now() - startTime));
		}
	}

	PacketUtils.sendPackets(context, response);
});

mqttClient.on("error", error => {
	CrowniclesLogger.errorWithObj("MQTT error", error);
});

crowniclesInstance = new Crownicles();
crowniclesInstance.init()
	.then();
