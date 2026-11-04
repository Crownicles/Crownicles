import {
	afterAll, beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";
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
import { LogsKingGuardFightsResults } from "../../src/core/database/logs/models/LogsKingGuardFightsResults";
import { LogsFightHistoryRequests } from "../../src/core/database/logs/requests/LogsFightHistoryRequests";
import { FightConstants } from "../../../Lib/src/constants/FightConstants";
import { getDateLogs } from "../../../Lib/src/utils/TimeUtils";
import { EloGameResult } from "../../../Lib/src/types/EloGameResult";
import {
	logPlayerFight, setupKingGuardFightsTable
} from "../_fightsLogsSetup";

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

beforeAll(async () => {
	env = await setupIntegrationDb("friendly_fights_logs");
	initLogsPlayers(env.sequelize);
	initFightsResults(env.sequelize);
	initGloryPoints(env.sequelize);
	await env.sequelize.sync();
	await setupKingGuardFightsTable(env.sequelize);
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
		await logPlayerFight({
			initiatorId: player.id, defenderId: opponent.id, friendly: false, date: 1_000
		});
		await logPlayerFight({
			initiatorId: opponent.id, defenderId: player.id, friendly: true, date: 2_000
		});
		await logPlayerFight({
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
		await logPlayerFight({
			initiatorId: player.id, defenderId: opponent.id, friendly: false, date: now
		});
		await logPlayerFight({
			initiatorId: player.id, defenderId: opponent.id, friendly: true, date: now
		});
		await logPlayerFight({
			initiatorId: player.id, defenderId: opponent.id, friendly: true, date: now
		});

		expect(await LogsFightHistoryRequests.getAttackCountInLastNWeeks("friendlyAttacker", 1)).toBe(1);
	});
});
