import { Op } from "sequelize";
import { LogsFightsResults } from "../models/LogsFightsResults";
import { LogsDatabase } from "../LogsDatabase";
import { DefenseRecordByAttackerClass } from "../../../../../../Lib/src/types/DefenseRecord";
import { Day } from "../../../../../../Lib/src/types/TimeTypes";
import {
	daysToSeconds, getDateLogs
} from "../../../../../../Lib/src/utils/TimeUtils";

// Value of the winner of a logged fight when the attacked player won
const LOGGED_DEFENDER_WIN = 2;

export abstract class LogsDefenseRequests {
	/**
	 * Ranked fights in which a player was attacked over the last days, by class of the attackers, the most frequent first
	 * @param keycloakId
	 * @param days
	 */
	static async getRecentDefensesByAttackerClass(keycloakId: string, days: Day): Promise<DefenseRecordByAttackerClass[]> {
		const logPlayer = await LogsDatabase.findOrCreatePlayer(keycloakId);
		if (!logPlayer) {
			return [];
		}
		const defenses = await LogsFightsResults.findAll({
			attributes: ["fightInitiatorClassId", "winner"],
			where: {
				player2Id: logPlayer.id,
				friendly: false,
				date: { [Op.gte]: getDateLogs() - daysToSeconds(days) },
				fightInitiatorClassId: { [Op.not]: null }
			}
		});
		const byClass = new Map<number, DefenseRecordByAttackerClass>();
		for (const defense of defenses) {
			const attackerClassId = defense.fightInitiatorClassId!;
			const record = byClass.get(attackerClassId) ?? {
				attackerClassId, defenses: 0, won: 0
			};
			record.defenses++;
			record.won += defense.winner === LOGGED_DEFENDER_WIN ? 1 : 0;
			byClass.set(attackerClassId, record);
		}
		return [...byClass.values()].sort((a, b) => b.defenses - a.defenses);
	}
}
