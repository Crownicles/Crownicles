import {
	Express, Request, Response
} from "express";
import {
	botConfig, crowniclesInstance
} from "../../index";
import {
	CrowniclesCoreMetrics, crowniclesMetricsRegistry
} from "./CrowniclesCoreMetrics";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { BlockingUtils } from "../utils/BlockingUtils";
import express = require("express");

export abstract class CrowniclesCoreWebServer {
	static start(): void {
		const app: Express = express();

		app.get("/metrics", async (_req: Request, res: Response) => {
			CrowniclesCoreMetrics.computeSporadicMetrics();
			res.setHeader("Content-Type", crowniclesMetricsRegistry.contentType);
			res.end(await crowniclesMetricsRegistry.metrics());
		});

		app.post("/maintenance", (req: Request, res: Response) => {
			const enabled = req.query.enabled === "1";
			crowniclesInstance!.setMaintenance(enabled, false);
			CrowniclesLogger.info("Maintenance mode changed", { enabled });
			res.status(200).send("OK");
		});

		app.get("/blocked_players", (_req: Request, res: Response) => {
			res.status(200).send(BlockingUtils.getBlockedPlayersCount().toString(10));
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

		app.listen(botConfig.WEB_SERVER_PORT, () => {
			CrowniclesLogger.info(`Web server is running on port ${botConfig.WEB_SERVER_PORT}`);
		});
	}
}

