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
import { LogsFightHistoryRequests } from "../../src/core/database/logs/requests/LogsFightHistoryRequests";
import { ClassConstants } from "../../../Lib/src/constants/ClassConstants";
import { AiPersonalityConstants } from "../../../Lib/src/constants/AiPersonalityConstants";
import {
	daysToSeconds, getDateLogs
} from "../../../Lib/src/utils/TimeUtils";
import { asDays } from "../../../Lib/src/types/TimeTypes";

// Importing the whole LogsDatabase boots the app: only its player resolver is needed here
vi.mock("../../src/core/database/logs/LogsDatabase", async () => {
	const { findOrCreateLogsPlayer } = await import("../../src/core/database/logs/LogsPlayerResolver");
	return { LogsDatabase: { findOrCreatePlayer: findOrCreateLogsPlayer } };
});

// Same for the leagues data, whose item helpers import the whole game
vi.mock("../../src/data/League", () => ({
	LeagueDataController: { instance: { getByGlory: (): { id: number } => ({ id: 1 }) } }
}));

const FIGHT_WINNER = {
	ATTACKER: 1,
	DEFENDER: 2
} as const;

let env: IntegrationTestEnvironment;

beforeAll(async () => {
	env = await setupIntegrationDb("recent_defenses");
	initLogsPlayers(env.sequelize);
	initFightsResults(env.sequelize);
	await env.sequelize.sync();
}, 60_000);

afterAll(async () => {
	if (env) {
		await env.teardown();
	}
}, 60_000);

beforeEach(async () => {
	await LogsFightsResults.destroy({ where: {} });
	await LogsPlayers.destroy({ where: {} });
});

async function logFight(params: {
	initiatorId: number;
	defenderId: number;
	initiatorClassId: number;
	winner: number;
	friendly?: boolean;
	date?: number;
}): Promise<void> {
	await LogsFightsResults.create({
		fightInitiatorId: params.initiatorId,
		fightInitiatorPoints: 0,
		player2Id: params.defenderId,
		player2Points: 0,
		turn: 10,
		winner: params.winner,
		friendly: params.friendly ?? false,
		fightInitiatorClassId: params.initiatorClassId,
		player2ClassId: ClassConstants.CLASSES_ID.KNIGHT,
		date: params.date ?? getDateLogs()
	});
}

describe("Recent defenses shown by the defense command", () => {
	it("sums up the ranked defenses of the player by class of the attackers, the most frequent first", async () => {
		const defender = await LogsPlayers.create({ keycloakId: "defender" });
		const attacker = await LogsPlayers.create({ keycloakId: "attacker" });
		const { GUNNER, MYSTIC_MAGE } = ClassConstants.CLASSES_ID;
		await logFight({
			initiatorId: attacker.id, defenderId: defender.id, initiatorClassId: MYSTIC_MAGE, winner: FIGHT_WINNER.DEFENDER
		});
		await logFight({
			initiatorId: attacker.id, defenderId: defender.id, initiatorClassId: GUNNER, winner: FIGHT_WINNER.ATTACKER
		});
		await logFight({
			initiatorId: attacker.id, defenderId: defender.id, initiatorClassId: GUNNER, winner: FIGHT_WINNER.DEFENDER
		});
		await logFight({
			initiatorId: attacker.id, defenderId: defender.id, initiatorClassId: GUNNER, winner: 0
		});

		expect(await LogsFightHistoryRequests.getRecentDefensesByAttackerClass("defender", AiPersonalityConstants.RECENT_DEFENSES_DAYS)).toEqual([
			{
				attackerClassId: GUNNER, defenses: 3, won: 1
			},
			{
				attackerClassId: MYSTIC_MAGE, defenses: 1, won: 1
			}
		]);
	});

	it("ignores the fights the player started, the friendly ones and the ones older than the window", async () => {
		const player = await LogsPlayers.create({ keycloakId: "player" });
		const other = await LogsPlayers.create({ keycloakId: "other" });
		const window = asDays(7);
		await logFight({
			initiatorId: player.id, defenderId: other.id, initiatorClassId: ClassConstants.CLASSES_ID.KNIGHT, winner: FIGHT_WINNER.DEFENDER
		});
		await logFight({
			initiatorId: other.id, defenderId: player.id, initiatorClassId: ClassConstants.CLASSES_ID.KNIGHT, winner: FIGHT_WINNER.DEFENDER, friendly: true
		});
		await logFight({
			initiatorId: other.id,
			defenderId: player.id,
			initiatorClassId: ClassConstants.CLASSES_ID.KNIGHT,
			winner: FIGHT_WINNER.DEFENDER,
			date: getDateLogs() - daysToSeconds(window) - 1
		});

		expect(await LogsFightHistoryRequests.getRecentDefensesByAttackerClass("player", window)).toEqual([]);
	});
});
