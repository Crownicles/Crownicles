import { loadConfig } from "./config/RestWsConfig";
import { CrowniclesLogger } from "../../Lib/src/logs/CrowniclesLogger";
import "source-map-support/register";
import { RestApi } from "./services/RestApi";
import { WebSocketServer } from "./services/WebSocketServer";
import { MqttManager } from "./mqtt/MqttManager";
import { registerAllClientTranslators } from "./packets/fromClient/FromClientTranslator";
import { registerAllServerTranslators } from "./packets/fromServer/FromServerTranslator";

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

// Load the configuration
export const restWsConfig = loadConfig();
export const keycloakConfig = {
	realm: restWsConfig.KEYCLOAK_REALM,
	url: restWsConfig.KEYCLOAK_URL,
	clientId: restWsConfig.KEYCLOAK_CLIENT_ID,
	clientSecret: restWsConfig.KEYCLOAK_CLIENT_SECRET
};

async function main(): Promise<void> {
	// Initialize the logger
	CrowniclesLogger.init(restWsConfig.LOGGER_LEVEL, restWsConfig.LOGGER_LOCATIONS, { app: "RestWs" }, restWsConfig.LOKI_HOST
		? {
			host: restWsConfig.LOKI_HOST,
			username: restWsConfig.LOKI_USERNAME,
			password: restWsConfig.LOKI_PASSWORD
		}
		: undefined);

	// Register all translators
	await registerAllClientTranslators();
	await registerAllServerTranslators();

	// Connect to the MQTT broker
	MqttManager.connectClients();

	// Initialize and start the Rest API server
	await new RestApi({
		allowNewUsersRegistering: restWsConfig.REST_API_ALLOW_NEW_USERS_REGISTERING,
		discordSso: restWsConfig.REST_API_DISCORD_SSO,
		betaLogin: restWsConfig.REST_API_BETA_LOGIN
	}).start(restWsConfig.REST_API_PORT);

	// Initialize and start the WebSocket server
	WebSocketServer.start(restWsConfig.WEB_SOCKET_PORT);

	// Log the version of the application
	CrowniclesLogger.info(`Crownicles RestWs ${process.env.npm_package_version}`);
}

main().then();
