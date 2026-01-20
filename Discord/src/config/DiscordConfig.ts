import { parse } from "toml";
import { readFileSync } from "fs";
import { DatabaseConfiguration } from "../../../Lib/src/database/DatabaseConfiguration";

/**
 * Represents the main constants of the bot
 */
export interface CrowniclesConfig {
	DISCORD_CLIENT_TOKEN: string;
	BADGE_MANAGER_ROLE: string;
	CONTRIBUTOR_ROLE: string;
	CONTRIBUTORS_CHANNEL: string;
	MAIN_SERVER_ID: string;
	CONSOLE_CHANNEL_ID: string;
	FRENCH_ANNOUNCEMENT_CHANNEL_ID: string;
	ENGLISH_ANNOUNCEMENT_CHANNEL_ID: string;
	DM_MANAGER_ID: string;
	KEYCLOAK_REALM: string;
	KEYCLOAK_URL: string;
	KEYCLOAK_CLIENT_ID: string;
	KEYCLOAK_CLIENT_SECRET: string;
	TEST_MODE: boolean;
	MQTT_HOST: string;
	MARIADB_HOST: string;
	MARIADB_USER: string;
	MARIADB_PASSWORD: string;
	MARIADB_ROOT_PASSWORD: string;
	MARIADB_PORT: number;
	PREFIX: string;
	DBL_TOKEN: string;
	WEB_SERVER_PORT: number;
	LOGGER_LEVEL: string;
	LOGGER_LOCATIONS: string[];
	LOKI_HOST?: string;
	LOKI_USERNAME?: string;
	LOKI_PASSWORD?: string;
	DELETION_SECRET: string;
}

type ConfigStructure = {
	general: {
		token: string;
		main_server_id: string;
		test_mode: boolean;
		prefix: string;
	};
	roles: {
		badge_manager_ids: string;
		contributor_role_id: string;
	};
	channels: {
		console_channel_id: string;
		contributor_channel: string;
		english_announcements_channel_id: string;
		french_announcements_channel_id: string;
	};
	users: {
		owner_id: string;
		dm_manager_id: string;
	};
	keycloak: {
		realm: string;
		url: string;
		clientId: string;
		clientSecret: string;
	};
	mqtt: { host: string };
	database: {
		host: string;
		user: string;
		password: string;
		root_password: string;
		port: number;
	};
	discord_bot_list: { token: string };
	others: { webserver_port: number };
	logs: {
		level: string;
		locations: string[];
		loki?: {
			host: string;
			username: string;
			password: string;
		};
	};
	security: {
		deletion_secret: string;
	};
};

/**
 * Loads the config from the config file
 */
export function loadConfig(): CrowniclesConfig {
	const config = parse(readFileSync(`${process.cwd()}/config/config.toml`, "utf-8")) as ConfigStructure;
	return {
		BADGE_MANAGER_ROLE: config.roles.badge_manager_ids,
		CONSOLE_CHANNEL_ID: config.channels.console_channel_id,
		CONTRIBUTORS_CHANNEL: config.channels.contributor_channel,
		CONTRIBUTOR_ROLE: config.roles.contributor_role_id,
		DISCORD_CLIENT_TOKEN: config.general.token,
		DM_MANAGER_ID: config.users.dm_manager_id,
		ENGLISH_ANNOUNCEMENT_CHANNEL_ID: config.channels.english_announcements_channel_id,
		FRENCH_ANNOUNCEMENT_CHANNEL_ID: config.channels.french_announcements_channel_id,
		MAIN_SERVER_ID: config.general.main_server_id,
		KEYCLOAK_REALM: config.keycloak.realm,
		KEYCLOAK_URL: config.keycloak.url,
		KEYCLOAK_CLIENT_ID: config.keycloak.clientId,
		KEYCLOAK_CLIENT_SECRET: config.keycloak.clientSecret,
		TEST_MODE: config.general.test_mode,
		MQTT_HOST: config.mqtt.host,
		MARIADB_HOST: config.database.host,
		MARIADB_USER: config.database.user,
		MARIADB_PASSWORD: config.database.password,
		MARIADB_ROOT_PASSWORD: config.database.root_password,
		MARIADB_PORT: config.database.port,
		PREFIX: config.general.prefix,
		DBL_TOKEN: config.discord_bot_list.token,
		WEB_SERVER_PORT: config.others.webserver_port,
		LOGGER_LEVEL: config.logs.level,
		LOGGER_LOCATIONS: config.logs.locations,
		LOKI_HOST: config.logs.loki?.host,
		LOKI_USERNAME: config.logs.loki?.username,
		LOKI_PASSWORD: config.logs.loki?.password,
		DELETION_SECRET: config.security.deletion_secret
	};
}

export function getDatabaseConfiguration(config: CrowniclesConfig, databaseName: string): DatabaseConfiguration {
	return {
		host: config.MARIADB_HOST,
		port: config.MARIADB_PORT,
		rootUser: "root",
		rootPassword: config.MARIADB_ROOT_PASSWORD,
		user: config.MARIADB_USER,
		userPassword: config.MARIADB_PASSWORD,
		databaseName,
		prefix: config.PREFIX
	};
}
