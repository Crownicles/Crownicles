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
	 * Log a blessing activation
	 */
	async logBlessingActivation(
		blessingType: number,
		triggeredByKeycloakId: string,
		poolThreshold: number,
		durationHours: number
	): Promise<void> {
		const player = await this.findOrCreatePlayer(triggeredByKeycloakId);
		await LogsBlessings.create({
			blessingType,
			action: "activate",
			triggeredByPlayerId: player ? player.id : null,
			poolThreshold,
			durationHours,
			date: getDateLogs()
		});
	}

	/**
	 * Log a blessing expiration (duration over)
	 */
	async logBlessingExpiration(blessingType: number, poolThreshold: number): Promise<void> {
		await LogsBlessings.create({
			blessingType,
			action: "expire",
			triggeredByPlayerId: null,
			poolThreshold,
			durationHours: null,
			date: getDateLogs()
		});
	}

	/**
	 * Log a pool expiration (4-day timeout without filling)
	 */
	async logBlessingPoolExpiration(_oldThreshold: number, newThreshold: number): Promise<void> {
		await LogsBlessings.create({
			blessingType: 0,
			action: "pool_expire",
			triggeredByPlayerId: null,
			poolThreshold: newThreshold,
			durationHours: null,
			date: getDateLogs()
		});
	}

	/**
	 * Log a player contribution to the blessing pool
	 */
	async logBlessingContribution(
		keycloakId: string,
		amount: number,
		newPoolAmount: number
	): Promise<void> {
		const player = await this.findOrCreatePlayer(keycloakId);
		if (!player) {
			return;
		}
		await LogsBlessingsContributions.create({
			playerId: player.id,
			amount,
			newPoolAmount,
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
