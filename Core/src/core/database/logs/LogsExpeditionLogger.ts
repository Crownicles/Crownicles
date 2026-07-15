import { LogsExpeditions } from "./models/LogsExpeditions";
import { LogsPetEntities } from "./models/LogsPetEntities";
import { findOrCreateLogsPlayer } from "./LogsPlayerResolver";
import { Op } from "sequelize";
import { ExpeditionConstants } from "../../../../../Lib/src/constants/ExpeditionConstants";
import {
	getDateLogs, getNextSundayMidnight, millisecondsToSeconds, msDiff
} from "../../../../../Lib/src/utils/TimeUtils";
import { TimeConstants } from "../../../../../Lib/src/constants/TimeConstants";
import {
	ExpeditionCompleteParams,
	ExpeditionLogData,
	ExpeditionRecallParams,
	ExpeditionRewards,
	ExpeditionStartParams
} from "./LogsDatabase";

/**
 * Parameters for logging expedition completion, grouping all needed data
 */
export interface ExpeditionCompleteLogInput {
	keycloakId: string;
	petGameId: number;
	params: ExpeditionCompleteParams;
	rewards: ExpeditionRewards | null;
	loveChange: number;
}

/**
 * Common identifier for expedition log entries
 */
export interface ExpeditionLogIdentifier {
	keycloakId: string;
	petGameId: number;
}

/**
 * Handles all expedition-related logging operations.
 * Extracted from LogsDatabase to reduce class size and improve cohesion.
 */
export class LogsExpeditionLogger {
	/**
	 * Find or create a pet entity in the log database by game id
	 */
	private async findOrCreatePetEntityByGameId(gameId: number): Promise<LogsPetEntities> {
		const existing = await LogsPetEntities.findOne({
			where: { gameId },
			order: [["creationTimestamp", "DESC"]]
		});
		if (existing) {
			return existing;
		}

		// If not found, create a placeholder with current timestamp
		return (await LogsPetEntities.findOrCreate({
			where: {
				gameId,
				creationTimestamp: getDateLogs()
			}
		}))[0];
	}

	/**
	 * Helper method to create expedition log entries with common logic
	 */
	private async createExpeditionLog(
		keycloakId: string,
		petGameId: number,
		data: Partial<ExpeditionLogData>
	): Promise<void> {
		const player = await findOrCreateLogsPlayer(keycloakId);
		if (!player) {
			return;
		}
		const petEntity = await this.findOrCreatePetEntityByGameId(petGameId);
		await LogsExpeditions.create({
			playerId: player.id,
			petId: petEntity.id,
			...data,
			date: getDateLogs()
		});
	}

	/**
	 * Log a simple expedition action (start or recall) with params spread
	 */
	private async logSimpleExpeditionAction(
		identifier: ExpeditionLogIdentifier,
		action: string,
		params: ExpeditionStartParams | ExpeditionRecallParams
	): Promise<void> {
		await this.createExpeditionLog(identifier.keycloakId, identifier.petGameId, {
			...params,
			action
		});
	}

	/**
	 * Log when a pet expedition starts
	 */
	async logExpeditionStart(
		identifier: ExpeditionLogIdentifier,
		params: ExpeditionStartParams
	): Promise<void> {
		await this.logSimpleExpeditionAction(identifier, ExpeditionConstants.LOG_ACTION.START, params);
	}

	/**
	 * Log when a pet expedition is completed
	 */
	async logExpeditionComplete(input: ExpeditionCompleteLogInput): Promise<void> {
		await this.createExpeditionLog(input.keycloakId, input.petGameId, {
			...input.params,
			action: ExpeditionConstants.LOG_ACTION.COMPLETE,
			money: input.rewards?.money ?? null,
			experience: input.rewards?.experience ?? null,
			points: input.rewards?.points ?? null,
			tokens: input.rewards?.tokens ?? null,
			cloneTalismanFound: input.rewards?.cloneTalismanFound ?? null,
			loveChange: input.loveChange
		});
	}

	/**
	 * Log when a pet expedition is cancelled before departure
	 */
	async logExpeditionCancel(identifier: ExpeditionLogIdentifier, loveChange: number): Promise<void> {
		await this.createExpeditionLog(identifier.keycloakId, identifier.petGameId, {
			mapLocationId: ExpeditionConstants.NO_MAP_LOCATION,
			locationType: ExpeditionConstants.LOG_ACTION.CANCEL,
			action: ExpeditionConstants.LOG_ACTION.CANCEL,
			durationMinutes: 0,
			rewardIndex: 0,
			foodConsumed: 0,
			loveChange
		});
	}

	/**
	 * Log when a pet is recalled from an expedition
	 */
	async logExpeditionRecall(
		identifier: ExpeditionLogIdentifier,
		params: ExpeditionRecallParams
	): Promise<void> {
		await this.logSimpleExpeditionAction(identifier, ExpeditionConstants.LOG_ACTION.RECALL, params);
	}

	/**
	 * Count the number of expedition cancellations (cancel + recall) for a player during the current week
	 * Both cancelling during preparation and recalling during expedition count towards the progressive penalty
	 */
	async countExpeditionCancellationsThisWeek(keycloakId: string): Promise<number> {
		const logPlayer = await findOrCreateLogsPlayer(keycloakId);
		if (!logPlayer) {
			return 0;
		}
		const startOfWeek = Math.floor(millisecondsToSeconds(msDiff(
			getNextSundayMidnight(),
			TimeConstants.MS_TIME.WEEK
		)));

		return LogsExpeditions.count({
			where: {
				playerId: logPlayer.id,
				action: { [Op.in]: [ExpeditionConstants.LOG_ACTION.CANCEL, ExpeditionConstants.LOG_ACTION.RECALL] },
				date: { [Op.gt]: startOfWeek }
			}
		});
	}
}
