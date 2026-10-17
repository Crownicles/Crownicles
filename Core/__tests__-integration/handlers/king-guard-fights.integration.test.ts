import {
	afterAll, beforeAll, beforeEach, describe, expect, it, vi
} from "vitest";
import { QueryInterface } from "sequelize";
import {
	IntegrationTestEnvironment, setupIntegrationDb
} from "../_setup";
import {
	initModel as initLogsPlayers, LogsPlayers
} from "../../src/core/database/logs/models/LogsPlayers";
import {
	initModel as initKingGuardResults, KING_GUARD_FIGHT_WINNER, LogsKingGuardFightsResults
} from "../../src/core/database/logs/models/LogsKingGuardFightsResults";
import {
	initModel as initFightsResults, LogsFightsResults
} from "../../src/core/database/logs/models/LogsFightsResults";
import {
	initModel as initGloryPoints, LogsPlayersGloryPoints
} from "../../src/core/database/logs/models/LogsPlayersGloryPoints";
import { LogsKingGuardFightsRequests } from "../../src/core/database/logs/requests/LogsKingGuardFightsRequests";
import { LogsFightHistoryRequests } from "../../src/core/database/logs/requests/LogsFightHistoryRequests";
import { up as createKingGuardTable } from "../../src/core/database/logs/migrations/036-king-guard-fights";
import { ClassConstants } from "../../../Lib/src/constants/ClassConstants";
import { FightConstants } from "../../../Lib/src/constants/FightConstants";
import {
	dateToLogs, getTodayMidnight
} from "../../../Lib/src/utils/TimeUtils";
import { EloGameResult } from "../../../Lib/src/types/EloGameResult";

// Importing the whole LogsDatabase boots the app: only its player resolver is needed by the fight history
vi.mock("../../src/core/database/logs/LogsDatabase", async () => {
	const { findOrCreateLogsPlayer } = await import("../../src/core/database/logs/LogsPlayerResolver");
	return { LogsDatabase: { findOrCreatePlayer: findOrCreateLogsPlayer } };
});

// Same for the leagues data, whose item helpers import the whole game; leagues are irrelevant here
vi.mock("../../src/data/League", () => ({
	LeagueDataController: { instance: { getByGlory: (): { id: number } => ({ id: 1 }) } }
}));

let env: IntegrationTestEnvironment;

async function logGuardFight(params: {
	playerId: number;
	classId?: number;
	guardLevel: number;
	winner: number;
	date: number;
}): Promise<void> {
	await LogsKingGuardFightsResults.create({
		playerId: params.playerId,
		classId: params.classId ?? ClassConstants.CLASSES_ID.KNIGHT,
		guardClassId: ClassConstants.CLASSES_ID.PALADIN,
		guardLevel: params.guardLevel,
		turn: 10,
		winner: params.winner,
		date: params.date
	});
}

beforeAll(async () => {
	env = await setupIntegrationDb("king_guard_fights");
	initLogsPlayers(env.sequelize);
	initFightsResults(env.sequelize);
	initGloryPoints(env.sequelize);
	await env.sequelize.sync();
	await createKingGuardTable({ context: env.sequelize.getQueryInterface() });
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

async function logRankedFight(params: {
	initiatorId: number;
	defenderId: number;
	date: number;
}): Promise<void> {
	const fight = await LogsFightsResults.create({
		fightInitiatorId: params.initiatorId,
		fightInitiatorPoints: 0,
		player2Id: params.defenderId,
		player2Points: 0,
		turn: 10,
		winner: 1,
		friendly: false,
		fightInitiatorInitialDefenseGlory: 100,
		fightInitiatorInitialAttackGlory: 100,
		fightInitiatorClassId: ClassConstants.CLASSES_ID.KNIGHT,
		player2InitialDefenseGlory: 100,
		player2InitialAttackGlory: 100,
		player2ClassId: ClassConstants.CLASSES_ID.KNIGHT,
		date: params.date
	});
	await LogsPlayersGloryPoints.bulkCreate([
		{
			playerId: params.initiatorId, value: 110, reason: 0, fightId: fight.id, date: params.date, isDefense: false
		},
		{
			playerId: params.defenderId, value: 90, reason: 0, fightId: fight.id, date: params.date, isDefense: true
		}
	]);
}

describe("King guard fights in the fight history", () => {
	it("merges the king guard fights with the ranked fights, most recent first", async () => {
		const player = await LogsPlayers.create({ keycloakId: "historyPlayer" });
		const opponent = await LogsPlayers.create({ keycloakId: "historyOpponent" });
		await logGuardFight({
			playerId: player.id, guardLevel: 30, winner: KING_GUARD_FIGHT_WINNER.GUARD, date: 1_000
		});
		await logRankedFight({
			initiatorId: player.id, defenderId: opponent.id, date: 2_000
		});
		await logGuardFight({
			playerId: player.id, guardLevel: 42, winner: KING_GUARD_FIGHT_WINNER.PLAYER, date: 3_000
		});

		const history = await LogsFightHistoryRequests.getFightHistory("historyPlayer", FightConstants.HISTORY_LIMIT);

		expect(history.map(fight => fight.date)).toEqual([3_000_000, 2_000_000, 1_000_000]);
		expect(history[0]).toEqual({
			date: 3_000_000,
			result: EloGameResult.WIN,
			classes: {
				me: ClassConstants.CLASSES_ID.KNIGHT,
				opponent: ClassConstants.CLASSES_ID.PALADIN
			},
			kingGuard: { level: 42 }
		});
		expect(history[1]).toMatchObject({
			initiator: true,
			opponentKeycloakId: "historyOpponent",
			result: EloGameResult.WIN
		});
		expect(history[2]).toMatchObject({
			result: EloGameResult.LOSS,
			kingGuard: { level: 30 }
		});
	});

	it("keeps only the most recent fights of both kinds", async () => {
		const player = await LogsPlayers.create({ keycloakId: "busyPlayer" });
		const opponent = await LogsPlayers.create({ keycloakId: "busyOpponent" });
		await logRankedFight({
			initiatorId: player.id, defenderId: opponent.id, date: 1_000
		});
		await logGuardFight({
			playerId: player.id, guardLevel: 30, winner: KING_GUARD_FIGHT_WINNER.DRAW, date: 2_000
		});
		await logRankedFight({
			initiatorId: opponent.id, defenderId: player.id, date: 3_000
		});

		const history = await LogsFightHistoryRequests.getFightHistory("busyPlayer", 2);

		expect(history).toHaveLength(2);
		expect(history[0]).toMatchObject({
			initiator: false,
			opponentKeycloakId: "busyOpponent",
			result: EloGameResult.LOSS
		});
		expect(history[1]).toMatchObject({
			result: EloGameResult.DRAW,
			kingGuard: { level: 30 }
		});
	});
});

describe("King guard fights logs", () => {
	it("creates the table with its indexes", async () => {
		const indexes = await (env.sequelize.getQueryInterface() as QueryInterface).showIndex("king_guard_fights_results");

		expect(indexes.map(index => index.name)).toEqual(expect.arrayContaining([
			"idx_king_guard_player_class",
			"idx_king_guard_player_date"
		]));
	});

	it("bases the next guard on the best guard beaten with the class lineage", async () => {
		const player = await LogsPlayers.create({ keycloakId: "winner" });
		await logGuardFight({
			playerId: player.id, guardLevel: 40, winner: KING_GUARD_FIGHT_WINNER.PLAYER, date: 1_000
		});
		await logGuardFight({
			playerId: player.id, guardLevel: 55, winner: KING_GUARD_FIGHT_WINNER.PLAYER, date: 1_100
		});
		await logGuardFight({
			playerId: player.id, guardLevel: 70, winner: KING_GUARD_FIGHT_WINNER.GUARD, date: 1_200
		});
		await logGuardFight({
			playerId: player.id, classId: ClassConstants.CLASSES_ID.MYSTIC_MAGE, guardLevel: 90, winner: KING_GUARD_FIGHT_WINNER.PLAYER, date: 1_300
		});

		await expect(LogsKingGuardFightsRequests.getGuardLevelBase({
			playerKeycloakId: "winner",
			classId: ClassConstants.CLASSES_ID.VALIANT_KNIGHT
		})).resolves.toBe(55);
	});

	it("lowers the base after the last lost guard when no guard was beaten", async () => {
		const player = await LogsPlayers.create({ keycloakId: "loser" });
		await logGuardFight({
			playerId: player.id, guardLevel: 50, winner: KING_GUARD_FIGHT_WINNER.GUARD, date: 1_000
		});
		await logGuardFight({
			playerId: player.id, guardLevel: 45, winner: KING_GUARD_FIGHT_WINNER.GUARD, date: 1_100
		});

		await expect(LogsKingGuardFightsRequests.getGuardLevelBase({
			playerKeycloakId: "loser",
			classId: ClassConstants.CLASSES_ID.KNIGHT
		})).resolves.toBe(45 - FightConstants.KING_GUARD.FAILED_FIGHT_LEVEL_REDUCTION);
	});

	it("has no base without any guard fight", async () => {
		await expect(LogsKingGuardFightsRequests.getGuardLevelBase({
			playerKeycloakId: "newcomer",
			classId: ClassConstants.CLASSES_ID.KNIGHT
		})).resolves.toBeNull();
	});

	it("counts only today's guard fights in the daily summary", async () => {
		const player = await LogsPlayers.create({ keycloakId: "daily" });
		const today = dateToLogs(getTodayMidnight()) + 60;
		await logGuardFight({
			playerId: player.id, guardLevel: 40, winner: KING_GUARD_FIGHT_WINNER.PLAYER, date: today
		});
		await logGuardFight({
			playerId: player.id, guardLevel: 40, winner: KING_GUARD_FIGHT_WINNER.DRAW, date: today
		});
		await logGuardFight({
			playerId: player.id, guardLevel: 40, winner: KING_GUARD_FIGHT_WINNER.GUARD, date: today
		});
		await logGuardFight({
			playerId: player.id, guardLevel: 40, winner: KING_GUARD_FIGHT_WINNER.PLAYER, date: today - 2 * 86_400
		});

		await expect(LogsKingGuardFightsRequests.getDailySummary("daily")).resolves.toEqual({
			played: 3,
			won: 1,
			draw: 1
		});
		await expect(LogsKingGuardFightsRequests.getDailySummary("nobody")).resolves.toEqual({
			played: 0,
			won: 0,
			draw: 0
		});
	});
});
