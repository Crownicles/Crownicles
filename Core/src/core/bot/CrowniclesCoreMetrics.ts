// skipcq: JS-C1003 - prom-client does not expose itself as an ES Module.
import * as client from "prom-client";
import { Sequelize } from "sequelize";
import { BlockingUtils } from "../utils/BlockingUtils";
import { PeriodicLoopName } from "./ResilientLoop";
import { asMilliseconds } from "../../../../Lib/src/types/TimeTypes";
import { millisecondsToSeconds } from "../../../../Lib/src/utils/TimeUtils";

export const crowniclesMetricsRegistry = new client.Registry();

export const MONITORED_DATABASES = {
	GAME: "game",
	LOGS: "logs"
} as const;

export type MonitoredDatabaseName = typeof MONITORED_DATABASES[keyof typeof MONITORED_DATABASES];

export type MonitoredDatabase = {
	name: MonitoredDatabaseName;
	sequelize: Sequelize;
};

type SequelizePoolStats = {
	size: number;
	available: number;
	using: number;
	waiting: number;
};

// Sequelize 6 does not type `connectionManager.pool`, which only exists at runtime.
type ConnectionManagerWithPool = Sequelize["connectionManager"] & { pool?: SequelizePoolStats };

export const EXTERNAL_APIS = { NEO_WS: "neows" } as const;

export type ExternalApiName = typeof EXTERNAL_APIS[keyof typeof EXTERNAL_APIS];

export const EXTERNAL_API_FAILURE_REASONS = {
	HTTP_STATUS: "http_status",
	NETWORK: "network",
	TIMEOUT: "timeout",
	INVALID_RESPONSE: "invalid_response"
} as const;

export type ExternalApiFailureReason = typeof EXTERNAL_API_FAILURE_REASONS[keyof typeof EXTERNAL_API_FAILURE_REASONS];

export abstract class CrowniclesCoreMetrics {
	private static packetsTimeHistogram = new client.Histogram({
		name: "crownicles_packets_time",
		help: "Histogram of packets times",
		labelNames: ["packet"],
		registers: [crowniclesMetricsRegistry]
	});

	private static packetsCount = new client.Counter({
		name: "crownicles_packets_count",
		help: "Count of packets",
		labelNames: ["packet"],
		registers: [crowniclesMetricsRegistry]
	});

	private static packetsErrorCount = new client.Counter({
		name: "crownicles_packets_error_count",
		help: "Count of packets errors",
		labelNames: ["packet"],
		registers: [crowniclesMetricsRegistry]
	});

	private static dailyTaskFailuresCount = new client.Counter({
		name: "crownicles_daily_task_failures_count",
		help: "Count of daily task failures",
		labelNames: ["task"],
		registers: [crowniclesMetricsRegistry]
	});

	private static blockedPlayersCount = new client.Gauge({
		name: "crownicles_blocked_players_count",
		help: "Count of blocked players",
		registers: [crowniclesMetricsRegistry]
	});

	private static blockedPlayersTimes = new client.Gauge({
		name: "crownicles_blocked_players_times",
		help: "Times of blocked players",
		labelNames: ["keycloakId", "reason"],
		registers: [crowniclesMetricsRegistry]
	});

	private static dbPoolSize = new client.Gauge({
		name: "crownicles_db_pool_size",
		help: "Number of connections in the Sequelize pool",
		labelNames: ["database"],
		registers: [crowniclesMetricsRegistry]
	});

	private static dbPoolAvailable = new client.Gauge({
		name: "crownicles_db_pool_available",
		help: "Number of idle connections in the Sequelize pool",
		labelNames: ["database"],
		registers: [crowniclesMetricsRegistry]
	});

	private static dbPoolUsing = new client.Gauge({
		name: "crownicles_db_pool_using",
		help: "Number of connections currently in use in the Sequelize pool",
		labelNames: ["database"],
		registers: [crowniclesMetricsRegistry]
	});

	private static dbPoolWaiting = new client.Gauge({
		name: "crownicles_db_pool_waiting",
		help: "Number of queries waiting for a connection from the Sequelize pool",
		labelNames: ["database"],
		registers: [crowniclesMetricsRegistry]
	});

	private static maintenanceMode = new client.Gauge({
		name: "crownicles_maintenance_mode",
		help: "1 when the bot is in maintenance mode, 0 otherwise",
		registers: [crowniclesMetricsRegistry]
	});

	private static loopLastRunTimestamp = new client.Gauge({
		name: "crownicles_loop_last_run_timestamp",
		help: "Unix timestamp in seconds of the last successful run of a periodic loop",
		labelNames: ["loop"],
		registers: [crowniclesMetricsRegistry]
	});

	private static externalApiCallsCount = new client.Counter({
		name: "crownicles_external_api_calls_count",
		help: "Count of calls made to external APIs",
		labelNames: ["api"],
		registers: [crowniclesMetricsRegistry]
	});

	private static externalApiFailuresCount = new client.Counter({
		name: "crownicles_external_api_failures_count",
		help: "Count of failed calls to external APIs",
		labelNames: ["api", "reason"],
		registers: [crowniclesMetricsRegistry]
	});

	static observePacketTime(packetName: string, time: number): void {
		this.packetsTimeHistogram.labels(packetName)
			.observe(time);
	}

	static incrementPacketCount(packetName: string): void {
		this.packetsCount.labels(packetName)
			.inc();
	}

	static incrementPacketErrorCount(packetName: string): void {
		this.packetsErrorCount.labels(packetName)
			.inc();
	}

	static incrementDailyTaskFailure(taskName: string): void {
		this.dailyTaskFailuresCount.labels(taskName)
			.inc();
	}

	static observeLoopRun(loop: PeriodicLoopName): void {
		this.loopLastRunTimestamp.labels(loop)
			.set(Math.floor(millisecondsToSeconds(asMilliseconds(Date.now()))));
	}

	static incrementExternalApiCall(api: ExternalApiName): void {
		this.externalApiCallsCount.labels(api)
			.inc();
	}

	static incrementExternalApiFailure(api: ExternalApiName, reason: ExternalApiFailureReason): void {
		this.externalApiFailuresCount.labels(api, reason)
			.inc();
	}

	static computeSporadicMetrics(databases: MonitoredDatabase[], isInMaintenance: boolean): void {
		// Blocked players count
		this.blockedPlayersCount.set(BlockingUtils.getBlockedPlayersCount());

		// Blocked players times
		const now = Date.now();
		this.blockedPlayersTimes.reset();
		BlockingUtils.getBlockedPlayers().forEach((blockingInfo, keycloakId) => {
			blockingInfo.forEach(block => {
				this.blockedPlayersTimes.labels(keycloakId, block.reason)
					.set(now - block.startTimestamp);
			});
		});

		this.maintenanceMode.set(isInMaintenance ? 1 : 0);

		for (const database of databases) {
			const pool = (database.sequelize.connectionManager as ConnectionManagerWithPool).pool;
			if (!pool) {
				continue;
			}
			this.dbPoolSize.labels(database.name)
				.set(pool.size);
			this.dbPoolAvailable.labels(database.name)
				.set(pool.available);
			this.dbPoolUsing.labels(database.name)
				.set(pool.using);
			this.dbPoolWaiting.labels(database.name)
				.set(pool.waiting);
		}
	}
}

client.collectDefaultMetrics({
	register: crowniclesMetricsRegistry
});
