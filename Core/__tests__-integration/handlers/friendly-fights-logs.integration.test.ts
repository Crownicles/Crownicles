import {
	afterAll, beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";
import { DataTypes } from "sequelize";
import {
	IntegrationTestEnvironment, setupIntegrationDb
} from "../_setup";
import {
	initModel as initLogsPlayers, LogsPlayers
} from "../../src/core/database/logs/models/LogsPlayers";
import {
	initModel as initFightsResults, LogsFightsResults
} from "../../src/core/database/logs/models/LogsFightsResults";
import {
	initModel as initGloryPoints, LogsPlayersGloryPoints
} from "../../src/core/database/logs/models/LogsPlayersGloryPoints";
import {
	initModel as initKingGuardResults, LogsKingGuardFightsResults
} from "../../src/core/database/logs/models/LogsKingGuardFightsResults";
import { up as createKingGuardTable } from "../../src/core/database/logs/migrations/036-king-guard-fights";
import { LogsFightHistoryRequests } from "../../src/core/database/logs/requests/LogsFightHistoryRequests";
import { ClassConstants } from "../../../Lib/src/constants/ClassConstants";
import { FightConstants } from "../../../Lib/src/constants/FightConstants";
import { getDateLogs } from "../../../Lib/src/utils/TimeUtils";
import { EloGameResult } from "../../../Lib/src/types/EloGameResult";

// Importing the whole LogsDatabase boots the app: only its player resolver is needed by these requests
vi.mock("../../src/core/database/logs/LogsDatabase", async () => {
	const { findOrCreateLogsPlayer } = await import("../../src/core/database/logs/LogsPlayerResolver");
	return { LogsDatabase: { findOrCreatePlayer: findOrCreateLogsPlayer } };
});

// Same for the leagues data, whose item helpers import the whole game; leagues are irrelevant here
vi.mock("../../src/data/League", () => ({
	LeagueDataController: { instance: { getByGlory: (): { id: number } => ({ id: 1 }) } }
}));
vi.mock("../../src/app", () => ({ crowniclesInstance: {} }));
vi.mock("../../src/bootstrap", () => ({ botConfig: {} }));

let env: IntegrationTestEnvironment;

/**
 * Log a fight like LogsDatabase.logFight does: only ranked fights come with their glory changes
 * @param params
 */
async function logFight(params: {
	initiatorId: number;
	defenderId: number;
	friendly: boolean;
	date: number;
}): Promise<void> {
	const fight = await LogsFightsResults.create({
		fightInitiatorId: params.initiatorId,
		fightInitiatorPoints: 0,
		player2Id: params.defenderId,
		player2Points: 0,
		turn: 10,
		winner: 1,
		friendly: params.friendly,
		fightInitiatorInitialDefenseGlory: 100,
		fightInitiatorInitialAttackGlory: 100,
		fightInitiatorClassId: ClassConstants.CLASSES_ID.KNIGHT,
		player2InitialDefenseGlory: 100,
		player2InitialAttackGlory: 100,
		player2ClassId: ClassConstants.CLASSES_ID.KNIGHT,
		date: params.date
	});
	if (params.friendly) {
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

beforeAll(async () => {
	env = await setupIntegrationDb("friendly_fights_logs");
	initLogsPlayers(env.sequelize);
	initFightsResults(env.sequelize);
	initGloryPoints(env.sequelize);
	await env.sequelize.sync();

	// The fight history also reads the king guard fights, whose table is created by its migrations
	await createKingGuardTable({ context: env.sequelize.getQueryInterface() });
	await env.sequelize.getQueryInterface().addColumn("king_guard_fights_results", "playerLevel", {
		type: DataTypes.SMALLINT.UNSIGNED,
		allowNull: true
	});
	initKingGuardResults(env.sequelize);
}, 60_000);

afterAll(async () => {
	if (env) {
		await env.teardown();
	}
}, 60_000);

beforeEach(async () => {
	await LogsKingGuardFightsResults.destroy({ where: {} });
	await LogsPlayersGloryPoints.destroy({ where: {} });
	await LogsFightsResults.destroy({ where: {} });
	await LogsPlayers.destroy({ where: {} });
});

describe("Logged friendly fights", () => {
	it("are left out of the fight history, which only shows fights with glory changes", async () => {
		const player = await LogsPlayers.create({ keycloakId: "friendlyHistoryPlayer" });
		const opponent = await LogsPlayers.create({ keycloakId: "friendlyHistoryOpponent" });
		await logFight({
			initiatorId: player.id, defenderId: opponent.id, friendly: false, date: 1_000
		});
		await logFight({
			initiatorId: opponent.id, defenderId: player.id, friendly: true, date: 2_000
		});
		await logFight({
			initiatorId: player.id, defenderId: opponent.id, friendly: true, date: 3_000
		});

		const history = await LogsFightHistoryRequests.getFightHistory("friendlyHistoryPlayer", FightConstants.HISTORY_LIMIT);

		expect(history).toHaveLength(1);
		expect(history[0]).toMatchObject({
			date: 1_000_000,
			initiator: true,
			opponentKeycloakId: "friendlyHistoryOpponent",
			result: EloGameResult.WIN
		});
	});

	it("are not counted as ranked attacks", async () => {
		const player = await LogsPlayers.create({ keycloakId: "friendlyAttacker" });
		const opponent = await LogsPlayers.create({ keycloakId: "friendlyDefender" });
		const now = getDateLogs();
		await logFight({
			initiatorId: player.id, defenderId: opponent.id, friendly: false, date: now
		});
		await logFight({
			initiatorId: player.id, defenderId: opponent.id, friendly: true, date: now
		});
		await logFight({
			initiatorId: player.id, defenderId: opponent.id, friendly: true, date: now
		});

		expect(await LogsFightHistoryRequests.getAttackCountInLastNWeeks("friendlyAttacker", 1)).toBe(1);
	});
});
