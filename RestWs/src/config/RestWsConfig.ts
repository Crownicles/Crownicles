import { parse } from "toml";
import { readFileSync } from "fs";
import {
	createMqttPrefix, MqttPrefix
} from "../../../Lib/src/utils/MqttTopicUtils";

/**
 * Represents the main config of the middleware
 */
export interface RestWsConfig {
	KEYCLOAK_REALM: string;
	KEYCLOAK_URL: string;
	KEYCLOAK_CLIENT_ID: string;
	KEYCLOAK_CLIENT_SECRET: string;
	MQTT_HOST: string;
	LOGGER_LEVEL: string;
	LOGGER_LOCATIONS: string[];
	LOKI_HOST?: string;
	LOKI_USERNAME?: string;
	LOKI_PASSWORD?: string;
	REST_API_ALLOW_NEW_USERS_REGISTERING: boolean;
	REST_API_PORT: number;
	WEB_SOCKET_PORT: number;
	PREFIX: MqttPrefix;
	DEBUG: boolean;
	ACCOUNT_DELETION: AccountDeletionConfig;
}

/**
 * How a deletion request is authenticated, and who gets warned about it
 */
export interface AccountDeletionConfig {
	SECRET: string;
	WEBHOOK_URL: string;
	SMTP: {
		HOST: string;
		PORT: number;
		USERNAME: string;
		PASSWORD: string;
		FROM: string;
		TO: string;
	};
}

/**
 * Represents the structure of the config file
 */
type ConfigStructure = {
	global: {
		prefix: string;
		debug: boolean;
	};
	restApi: {
		allowRegister: boolean;
		port: number;
	};
	webSocket: { port: number };
	keycloak: {
		realm: string;
		url: string;
		clientId: string;
		clientSecret: string;
	};
	mqtt: { host: string };
	accountDeletion?: {
		secret?: string;
		webhookUrl?: string;
		smtp?: {
			host?: string;
			port?: number;
			username?: string;
			password?: string;
			from?: string;
			to?: string;
		};
	};
	logs: {
		level: string;
		locations: string[];
		loki?: {
			host: string;
			username: string;
			password: string;
		};
	};
};

const DEFAULT_SMTP_PORT = 587;

/**
 * The account deletion section is optional: a missing value leaves the matching warning channel off
 */
function loadAccountDeletionConfig(section: ConfigStructure["accountDeletion"] = {}): AccountDeletionConfig {
	const smtp = section.smtp ?? {};
	return {
		SECRET: section.secret ?? "",
		WEBHOOK_URL: section.webhookUrl ?? "",
		SMTP: {
			HOST: smtp.host ?? "",
			PORT: smtp.port ?? DEFAULT_SMTP_PORT,
			USERNAME: smtp.username ?? "",
			PASSWORD: smtp.password ?? "",
			FROM: smtp.from ?? "",
			TO: smtp.to ?? ""
		}
	};
}

/**
 * Loads the config from the config file
 */
export function loadConfig(): RestWsConfig {
	const config = parse(readFileSync(`${process.cwd()}/config/config.toml`, "utf-8")) as ConfigStructure;

	return {
		KEYCLOAK_REALM: config.keycloak.realm,
		KEYCLOAK_URL: config.keycloak.url,
		KEYCLOAK_CLIENT_ID: config.keycloak.clientId,
		KEYCLOAK_CLIENT_SECRET: config.keycloak.clientSecret,
		MQTT_HOST: config.mqtt.host,
		LOGGER_LEVEL: config.logs.level,
		LOGGER_LOCATIONS: config.logs.locations,
		LOKI_HOST: config.logs.loki?.host,
		LOKI_USERNAME: config.logs.loki?.username,
		LOKI_PASSWORD: config.logs.loki?.password,
		REST_API_ALLOW_NEW_USERS_REGISTERING: config.restApi.allowRegister,
		REST_API_PORT: config.restApi.port,
		WEB_SOCKET_PORT: config.webSocket.port,
		PREFIX: createMqttPrefix(config.global.prefix),
		DEBUG: config.global.debug,
		ACCOUNT_DELETION: loadAccountDeletionConfig(config.accountDeletion)
	};
}

