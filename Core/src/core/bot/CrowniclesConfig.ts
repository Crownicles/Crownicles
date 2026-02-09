import { parse } from "toml";
import { readFileSync } from "fs";
import { DatabaseConfiguration } from "../../../../Lib/src/database/DatabaseConfiguration";
import {
	createMqttPrefix, MqttPrefix
} from "../../../../Lib/src/utils/MqttTopicUtils";

/**
 * Represents the main constants of the bot
 */
export interface CrowniclesConfig {
	MODE_MAINTENANCE: boolean;
	TEST_MODE: boolean;
	PREFIX: MqttPrefix;
	MARIADB_HOST: string;
	MARIADB_USER: string;
	MARIADB_PASSWORD: string;
	MARIADB_ROOT_PASSWORD: string;
	MARIADB_PORT: number;
	MQTT_HOST: string;
	WEB_SERVER_PORT: number;
	LOG_LEVEL: string;
	LOG_LOCATIONS: string[];
	LOKI_HOST?: string;
	LOKI_USERNAME?: string;
	LOKI_PASSWORD?: string;
}

type ConfigStructure = {
	bot: {
		maintenance: boolean;
		test_mode: boolean;
		prefix: string;
	};
	others: {
		webserver_port: number;
		log_packets: boolean;
	};
	database: {
		host: string;
		user: string;
		password: string;
		root_password: string;
		port: number;
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
export function loadConfig(): CrowniclesConfig {
	const config = parse(readFileSync(`${process.cwd()}/config/config.toml`, "utf-8")) as ConfigStructure;
	return {
		MODE_MAINTENANCE: config.bot.maintenance,
		TEST_MODE: config.bot.test_mode,
		PREFIX: createMqttPrefix(config.bot.prefix),
		MARIADB_HOST: config.database.host,
		MARIADB_USER: config.database.user,
		MARIADB_PASSWORD: config.database.password,
		MARIADB_ROOT_PASSWORD: config.database.root_password,
		MARIADB_PORT: config.database.port,
		MQTT_HOST: config.mqtt.host,
		WEB_SERVER_PORT: config.others.webserver_port,
		LOG_LEVEL: config.logs.level,
		LOG_LOCATIONS: config.logs.locations,
		LOKI_HOST: config.logs.loki?.host,
		LOKI_USERNAME: config.logs.loki?.username,
		LOKI_PASSWORD: config.logs.loki?.password
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
