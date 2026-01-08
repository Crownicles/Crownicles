import {
	createLogger, format, Logger, transports
} from "winston";
import "winston-daily-rotate-file";
import { Constants } from "../constants/Constants";
import LokiTransport = require("winston-loki");

/**
 * Safely stringify an object, handling circular references
 * @param obj - Object to stringify
 * @returns JSON string or "[Circular]" placeholder for circular refs
 */
export function safeStringify(obj: unknown): string {
	if (obj === undefined) {
		return "undefined";
	}
	const seen = new WeakSet();
	return JSON.stringify(obj, (_key, value) => {
		if (typeof value === "object" && value !== null) {
			if (seen.has(value)) {
				return "[Circular]";
			}
			seen.add(value);
		}
		return value;
	});
}

const myFormatWithLabel = format.printf(({
	level, message, metadata, label, timestamp
}) =>
	`${timestamp} [${label}] [${level.toUpperCase()}]: ${message}${metadata && Object.keys(metadata).length > 0 ? ` ${safeStringify(metadata)}` : ""}`);

const myFormat = format.printf(({
	level, message, metadata, timestamp
}) =>
	`${timestamp} [${level.toUpperCase()}]: ${message}${metadata && Object.keys(metadata).length > 0 ? ` ${safeStringify(metadata)}` : ""}`);

type LogMetadata = { [key: string]: unknown } & {
	error?: never;
	level?: never;
	message?: never;
	timestamp?: never;
	label?: never;
};

export abstract class CrowniclesLogger {
	private static logger: Logger;

	public static init(level: string, locations: string[], labels: { [key: string]: string }, lokiSettings?: {
		host: string;
		username?: string;
		password?: string;
	}): void {
		const transportsList = [];
		for (const location of locations) {
			switch (location) {
				case "console":
					transportsList.push(new transports.Console());
					break;
				case "file":
					transportsList.push(new transports.DailyRotateFile({
						filename: `${Constants.LOGS.FILE_BASE_PATH}/%DATE%.log`,
						datePattern: "YYYY-MM-DD",
						zippedArchive: Constants.LOGS.FILE_ZIPPED_ARCHIVE,
						maxSize: Constants.LOGS.FILE_MAX_SIZE,
						maxFiles: Constants.LOGS.FILE_RETENTION
					}));
					break;
				case "loki":
					if (!lokiSettings) {
						throw new Error("Loki settings are required for loki transport");
					}
					transportsList.push(new LokiTransport({
						labels,
						host: lokiSettings.host,
						basicAuth: lokiSettings.username
							&& lokiSettings.password
							&& lokiSettings.username !== ""
							&& lokiSettings.password !== ""
							? `${lokiSettings.username}:${lokiSettings.password}`
							: undefined,
						format: format.simple(),
						json: true,
						onConnectionError: console.error,
						interval: 5,
						timeout: 5
					}));
					break;
				default:
					throw new Error(`Unknown log location: ${location}`);
			}
		}

		const formatToUse = Object.keys(labels).length > 0
			? format.combine(
				format.metadata(),
				format.label({ label: Object.entries(labels).map(l => `${l[0]}=${l[1]}`)
					.join(",") }),
				format.timestamp({
					format: "YYYY-MM-DD HH:mm:ss.SSS"
				}),
				myFormatWithLabel
			)
			: format.combine(
				format.metadata(),
				format.timestamp({
					format: "YYYY-MM-DD HH:mm:ss.SSS"
				}),
				myFormat
			);

		this.logger = createLogger({
			level,
			format: formatToUse,
			transports: transportsList
		});

		console.log("Logger initialized with level:", level);
		console.log("Logger transports:", locations);
		console.log("Logger labels:", labels);
	}

	public static get(): Logger {
		if (!this.logger) {
			throw new Error("Logger not initialized");
		}
		return this.logger;
	}

	public static isInitialized(): boolean {
		return Boolean(this.logger);
	}

	public static error(message: string, metadata?: LogMetadata): void {
		this.get().error(message, metadata);
	}

	public static errorWithObj(message: string, e: unknown): void {
		if (e instanceof Error) {
			this.get().error(message, e);
		}
		else {
			this.get().error(message, new Error(String(e)));
		}
	}

	public static warn(message: string, metadata?: LogMetadata): void {
		this.get().warn(message, metadata);
	}

	public static info(message: string, metadata?: LogMetadata): void {
		this.get().info(message, metadata);
	}

	public static debug(message: string, metadata?: LogMetadata): void {
		this.get().debug(message, metadata);
	}
}
