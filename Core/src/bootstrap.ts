import "source-map-support/register";
import { loadConfig } from "./core/bot/CrowniclesConfig";
import { CrowniclesLogger } from "../../Lib/src/logs/CrowniclesLogger";
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

if (!CrowniclesLogger.isInitialized()) {
	CrowniclesLogger.init(botConfig.LOG_LEVEL, botConfig.LOG_LOCATIONS, { app: "Core" }, botConfig.LOKI_HOST
		? {
			host: botConfig.LOKI_HOST,
			username: botConfig.LOKI_USERNAME,
			password: botConfig.LOKI_PASSWORD
		}
		: undefined);

	CrowniclesLogger.info(`${CoreConstants.OPENING_LINE} - ${process.env.npm_package_version}`);
}
