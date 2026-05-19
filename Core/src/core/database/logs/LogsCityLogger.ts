import { LogsInnMeals } from "./models/LogsInnMeals";
import { LogsInnRooms } from "./models/LogsInnRooms";
import { LogsPlayers } from "./models/LogsPlayers";
import { getDateLogs } from "../../../../../Lib/src/utils/TimeUtils";

/**
 * Parameters for logging an inn meal purchase
 */
export interface InnMealLogParams {
	keycloakId: string;
	cityId: string;
	innId: string;
	mealId: string;
	price: number;
	energyGained: number;
	energyBefore: number | null;
}

/**
 * Parameters for logging an inn room rental
 */
export interface InnRoomLogParams {
	keycloakId: string;
	cityId: string;
	innId: string;
	roomId: string;
	price: number;
	healthGained: number;
	healthBefore: number | null;
}

/**
 * Handles all city-related logging operations: inns, blacksmith, enchanter,
 * housing (homes, apartments), city shops, guild domain and home features
 * (cooking, garden). Extracted from LogsDatabase to keep the central facade
 * focused on its own legacy responsibilities.
 *
 * Each method follows the same fire-and-forget contract as the rest of the
 * logs subsystem: callers invoke `logXxx(...).then()` and never await — the
 * write goes to a separate database via a separate Sequelize instance, so
 * it cannot affect the game-side transaction.
 */
export class LogsCityLogger {
	/**
	 * Find or create a player in the logs database by keycloak ID
	 */
	private async findOrCreatePlayer(keycloakId: string): Promise<LogsPlayers | null> {
		if (!keycloakId) {
			return null;
		}
		return (await LogsPlayers.findOrCreate({
			where: { keycloakId }
		}))[0];
	}

	/**
	 * Log when a player buys a meal at a city inn.
	 *
	 * The `energyBefore` field is optional and provides the player's energy
	 * level **before** the meal was applied. Combined with `energyGained`
	 * and the player's max energy at log time, it lets us measure energy
	 * waste (the overflow when a near-full player buys an expensive meal).
	 */
	async logInnMeal(params: InnMealLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsInnMeals.create({
			playerId: player.id,
			cityId: params.cityId,
			innId: params.innId,
			mealId: params.mealId,
			price: params.price,
			energyGained: params.energyGained,
			energyBefore: params.energyBefore,
			date: getDateLogs()
		});
	}

	/**
	 * Log when a player rents a room at a city inn.
	 *
	 * Same rationale as {@link logInnMeal} for the `healthBefore` field:
	 * measures how often players rent expensive rooms while already near
	 * full health.
	 */
	async logInnRoom(params: InnRoomLogParams): Promise<void> {
		const player = await this.findOrCreatePlayer(params.keycloakId);
		if (!player) {
			return;
		}
		await LogsInnRooms.create({
			playerId: player.id,
			cityId: params.cityId,
			innId: params.innId,
			roomId: params.roomId,
			price: params.price,
			healthGained: params.healthGained,
			healthBefore: params.healthBefore,
			date: getDateLogs()
		});
	}
}
