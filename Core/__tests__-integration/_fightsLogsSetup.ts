import {
	DataTypes, Sequelize
} from "sequelize";
import { LogsFightsResults } from "../src/core/database/logs/models/LogsFightsResults";
import { LogsPlayersGloryPoints } from "../src/core/database/logs/models/LogsPlayersGloryPoints";
import { initModel as initKingGuardResults } from "../src/core/database/logs/models/LogsKingGuardFightsResults";
import { up as createKingGuardTable } from "../src/core/database/logs/migrations/036-king-guard-fights";
import { up as addKingGuardRatings } from "../src/core/database/logs/migrations/040-king-guard-ratings";
import { ClassConstants } from "../../Lib/src/constants/ClassConstants";

/**
 * Create the king guard fights table through its migrations and init its model: the fight history also reads it
 * @param sequelize
 */
export async function setupKingGuardFightsTable(sequelize: Sequelize): Promise<void> {
	await createKingGuardTable({ context: sequelize.getQueryInterface() });

	// Column added by the migration 039, which also needs the PvE fights table
	await sequelize.getQueryInterface().addColumn("king_guard_fights_results", "playerLevel", {
		type: DataTypes.SMALLINT.UNSIGNED,
		allowNull: true
	});
	await addKingGuardRatings({ context: sequelize.getQueryInterface() });
	initKingGuardResults(sequelize);
}

/**
 * Log a fight won by its initiator like LogsDatabase.logFight does: only ranked fights come with their glory changes
 * @param params
 */
export async function logPlayerFight(params: {
	initiatorId: number;
	defenderId: number;
	date: number;
	friendly?: boolean;
}): Promise<void> {
	const friendly = params.friendly ?? false;
	const fight = await LogsFightsResults.create({
		fightInitiatorId: params.initiatorId,
		fightInitiatorPoints: 0,
		player2Id: params.defenderId,
		player2Points: 0,
		turn: 10,
		winner: 1,
		friendly,
		fightInitiatorInitialDefenseGlory: 100,
		fightInitiatorInitialAttackGlory: 100,
		fightInitiatorClassId: ClassConstants.CLASSES_ID.KNIGHT,
		player2InitialDefenseGlory: 100,
		player2InitialAttackGlory: 100,
		player2ClassId: ClassConstants.CLASSES_ID.KNIGHT,
		date: params.date
	});
	if (friendly) {
		return;
	}
	await LogsPlayersGloryPoints.bulkCreate([
		{
			playerId: params.initiatorId, value: 110, reason: 0, fightId: fight.id, date: params.date, isDefense: false
		},
		{
			playerId: params.defenderId, value: 90, reason: 0, fightId: fight.id, date: params.date, isDefense: true
		}
	]);
}
