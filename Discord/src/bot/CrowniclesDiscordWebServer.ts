import {
	Express, Request, Response
} from "express";
import { crowniclesMetricsRegistry } from "./CrowniclesDiscordMetrics";
import { discordConfig } from "./CrowniclesShard";
import { CrowniclesLogger } from "../../../Lib/src/logs/CrowniclesLogger";
import express = require("express");

export abstract class CrowniclesDiscordWebServer {
	static start(shardId: number): void {
		const app: Express = express();

		app.get("/metrics", async (_req: Request, res: Response) => {
			res.setHeader("Content-Type", crowniclesMetricsRegistry.contentType);
			res.end(await crowniclesMetricsRegistry.metrics());
		});

		app.post("/log_level", (req: Request, res: Response) => {
			const logger = CrowniclesLogger.get();
			if (!req.query.level) {
				res.status(400).send("Missing log level");
				return;
			}
			logger.level = req.query.level.toString();
			logger.info("Log level changed", { logLevel: logger.level });
			res.status(200).send("OK");
		});

		app.listen(discordConfig.WEB_SERVER_PORT + shardId, () => {
			CrowniclesLogger.info(`Web server is running on port ${discordConfig.WEB_SERVER_PORT + shardId}`);
		});
	}
}

