import { parse } from "toml";
import { readFileSync } from "fs";
import { DiscordSsoConfig } from "./DiscordSsoConfig";
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
	REST_API_DISCORD_SSO?: DiscordSsoConfig;
	REST_API_BETA_LOGIN: boolean;
	WEB_SOCKET_PORT: number;
	PREFIX: MqttPrefix;
}

/**
 * Represents the structure of the config file
 */
type ConfigStructure = {
	global: { prefix: string };
	restApi: {
		allowRegister: boolean;
		port: number;
		discordSso?: DiscordSsoConfig;
		betaLogin: boolean;
	};
	webSocket: { port: number };
	keycloak: {
		realm: string;
		url: string;
		clientId: string;
		clientSecret: string;
	};
	mqtt: { host: string };
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
		REST_API_DISCORD_SSO: config.restApi.discordSso
			? {
				clientId: config.restApi.discordSso.clientId,
				clientSecret: config.restApi.discordSso.clientSecret,
				callbackUrl: config.restApi.discordSso.callbackUrl
			}
			: undefined,
		REST_API_BETA_LOGIN: config.restApi.betaLogin,
		WEB_SOCKET_PORT: config.webSocket.port,
		PREFIX: createMqttPrefix(config.global.prefix)
	};
}

