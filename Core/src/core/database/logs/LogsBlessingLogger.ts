import { LogsBlessings } from "./models/LogsBlessings";
import { LogsBlessingsContributions } from "./models/LogsBlessingsContributions";
import { LogsPlayers } from "./models/LogsPlayers";
import {
	fn, col, Op
} from "sequelize";
import {
	dateToLogs, getDateLogs
} from "../../../../../Lib/src/utils/TimeUtils";

/**
 * Parameters for logging a blessing activation
 */
export interface BlessingActivationParams {
	blessingType: number;
	triggeredByKeycloakId: string;
	poolThreshold: number;
	durationHours: number;
}

/**
 * Parameters for logging a blessing contribution
 */
export interface BlessingContributionParams {
	keycloakId: string;
	amount: number;
	newPoolAmount: number;
}

/**
 * Internal structure for creating blessing log entries
 */
interface BlessingLogEntry {
	blessingType: number;
	action: string;
	triggeredByPlayerId: number | null;
	poolThreshold: number;
	durationHours: number | null;
}

/**
 * Handles all blessing-related logging operations.
 * Extracted from LogsDatabase to reduce class size and improve cohesion.
 */
export class LogsBlessingLogger {
	/**
	 * Find or create a player in the logs database by keycloak ID
	 */
	private async findOrCreatePlayer(keycloakId: string): Promise<LogsPlayers | null> {
		if (keycloakId === "") {
			return null;
		}
		return (await LogsPlayers.findOrCreate({
			where: { keycloakId }
		}))[0];
	}

	/**
	 * Create a blessing log entry with common fields
	 */
	private async createBlessingLog(entry: BlessingLogEntry): Promise<void> {
		await LogsBlessings.create({
			...entry,
			date: getDateLogs()
		});
	}

	/**
	 * Log a blessing activation
	 */
	async logBlessingActivation(params: BlessingActivationParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.triggeredByKeycloakId);
		await this.createBlessingLog({
			blessingType: params.blessingType,
			action: "activate",
			triggeredByPlayerId: player ? player.id : null,
			poolThreshold: params.poolThreshold,
			durationHours: params.durationHours
		});
	}

	/**
	 * Log a blessing expiration (duration over)
	 */
	async logBlessingExpiration(blessingType: number, poolThreshold: number): Promise<void> {
		await this.createBlessingLog({
			blessingType,
			action: "expire",
			triggeredByPlayerId: null,
			poolThreshold,
			durationHours: null
		});
	}

	/**
	 * Log a pool expiration (4-day timeout without filling)
	 */
	async logBlessingPoolExpiration(newThreshold: number): Promise<void> {
		await this.createBlessingLog({
			blessingType: 0,
			action: "pool_expire",
			triggeredByPlayerId: null,
			poolThreshold: newThreshold,
			durationHours: null
		});
	}

	/**
	 * Log a player contribution to the blessing pool
	 */
	async logBlessingContribution(params: BlessingContributionParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsBlessingsContributions.create({
			playerId: player.id,
			amount: params.amount,
			newPoolAmount: params.newPoolAmount,
			date: getDateLogs()
		});
	}

	/**
	 * Get the total lifetime contribution amount for a player
	 */
	async getLifetimeContributions(keycloakId: string): Promise<number> {
		const player = await this.findOrCreatePlayer(keycloakId);
		if (!player) {
			return 0;
		}
		return await LogsBlessingsContributions.sum("amount", {
			where: { playerId: player.id }
		}) ?? 0;
	}

	/**
	 * Get all contributions since a given date, grouped by player keycloakId
	 * Used to rebuild the in-memory contributionsTracker after a restart
	 */
	async getContributionsSince(since: Date): Promise<Map<string, number>> {
		const results = await LogsBlessingsContributions.findAll({
			attributes: [
				"playerId",
				[fn("SUM", col("amount")), "totalAmount"]
			],
			where: {
				date: { [Op.gte]: dateToLogs(since) }
			},
			group: ["playerId"],
			raw: true
		}) as unknown as {
			playerId: number;
			totalAmount: number;
		}[];

		const contributionsMap = new Map<string, number>();
		for (const row of results) {
			const player = await LogsPlayers.findByPk(row.playerId);
			if (player) {
				contributionsMap.set(player.keycloakId, row.totalAmount);
			}
		}
		return contributionsMap;
	}
}
