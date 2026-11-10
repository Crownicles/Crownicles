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
	KING_GUARD_FIGHT_WINNER, LogsKingGuardFightsResults
} from "../../src/core/database/logs/models/LogsKingGuardFightsResults";
import {
	initModel as initFightsResults, LogsFightsResults
} from "../../src/core/database/logs/models/LogsFightsResults";
import {
	initModel as initGloryPoints, LogsPlayersGloryPoints
} from "../../src/core/database/logs/models/LogsPlayersGloryPoints";
import {
	initModel as initKingGuardStates, KingGuardState
} from "../../src/core/database/game/models/KingGuardState";
import { LogsKingGuardFightsRequests } from "../../src/core/database/logs/requests/LogsKingGuardFightsRequests";
import { LogsFightHistoryRequests } from "../../src/core/database/logs/requests/LogsFightHistoryRequests";
import { getKingGuardFightStats } from "../../src/core/fights/kingGuards/KingGuardStats";
import { KingGuardDataController } from "../../src/data/KingGuard";
import { ClassConstants } from "../../../Lib/src/constants/ClassConstants";
import { FightConstants } from "../../../Lib/src/constants/FightConstants";
import {
	dateToLogs, getTodayMidnight
} from "../../../Lib/src/utils/TimeUtils";
import { EloGameResult } from "../../../Lib/src/types/EloGameResult";
import {
	logPlayerFight, setupKingGuardFightsTable
} from "../_fightsLogsSetup";

// Importing the whole LogsDatabase boots the app: only its player resolver is needed by the fight history
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

async function logGuardFight(params: {
	playerId: number;
	guardLevel?: number;
	guardId?: number | null;
	winner: number;
	date: number;
}): Promise<void> {
	await LogsKingGuardFightsResults.create({
		playerId: params.playerId,
		classId: ClassConstants.CLASSES_ID.KNIGHT,
		guardClassId: ClassConstants.CLASSES_ID.PALADIN,
		guardLevel: params.guardLevel ?? 120,
		turn: 10,
		winner: params.winner,
		playerLevel: null,
		guardId: params.guardId ?? null,
		date: params.date
	});
}

async function setGuardGlories(glories: Record<number, number>): Promise<void> {
	for (const [id, glory] of Object.entries(glories)) {
		await KingGuardState.upsert({
			id: Number(id), glory
		});
	}
}

beforeAll(async () => {
	env = await setupIntegrationDb("king_guard_fights");
	initLogsPlayers(env.sequelize);
	initFightsResults(env.sequelize);
	initGloryPoints(env.sequelize);
	initKingGuardStates(env.sequelize);
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
	await KingGuardState.destroy({ where: {} });
});

describe("King guard fights in the fight history", () => {
	it("merges the king guard fights with the ranked fights, most recent first, with the id of the guards of the library", async () => {
		const player = await LogsPlayers.create({ keycloakId: "historyPlayer" });
		const opponent = await LogsPlayers.create({ keycloakId: "historyOpponent" });
		await logGuardFight({
			playerId: player.id, guardLevel: 30, winner: KING_GUARD_FIGHT_WINNER.GUARD, date: 1_000
		});
		await logPlayerFight({
			initiatorId: player.id, defenderId: opponent.id, date: 2_000
		});
		await logGuardFight({
			playerId: player.id, guardLevel: 142, guardId: 625, winner: KING_GUARD_FIGHT_WINNER.PLAYER, date: 3_000
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
			kingGuard: {
				level: 142, id: 625
			}
		});
		expect(history[1]).toMatchObject({
			initiator: true,
			opponentKeycloakId: "historyOpponent",
			result: EloGameResult.WIN
		});

		// A guard generated on the fly before the library has no id
		expect(history[2]).toMatchObject({
			result: EloGameResult.LOSS,
			kingGuard: { level: 30 }
		});
		expect(history[2]).not.toHaveProperty("kingGuard.id");
	});
});

describe("King guard fights logs", () => {
	it("creates the table with its indexes and the columns of the ratings", async () => {
		const queryInterface = env.sequelize.getQueryInterface() as QueryInterface;
		const indexes = await queryInterface.showIndex("king_guard_fights_results");
		const columns = await queryInterface.describeTable("king_guard_fights_results");

		expect(indexes.map(index => index.name)).toEqual(expect.arrayContaining([
			"idx_king_guard_player_class",
			"idx_king_guard_player_date"
		]));
		expect(Object.keys(columns)).toEqual(expect.arrayContaining([
			"guardId", "playerGuardGlory", "playerGuardGloryChange", "guardGlory", "guardGloryChange"
		]));
	});

	it("lists the last guards of the library a player fought, the most recent first and each one once", async () => {
		const player = await LogsPlayers.create({ keycloakId: "regular" });
		const fights = [
			{
				guardId: 10, date: 1_000
			},
			{
				guardId: null, date: 1_100
			},
			{
				guardId: 20, date: 1_200
			},
			{
				guardId: 10, date: 1_300
			},
			{
				guardId: 30, date: 1_400
			}
		];
		for (const fight of fights) {
			await logGuardFight({
				playerId: player.id, winner: KING_GUARD_FIGHT_WINNER.PLAYER, ...fight
			});
		}

		await expect(LogsKingGuardFightsRequests.getLastGuardIds("regular", 3)).resolves.toEqual([30, 10, 20]);
		await expect(LogsKingGuardFightsRequests.getLastGuardIds("stranger", 3)).resolves.toEqual([]);
		await expect(LogsKingGuardFightsRequests.countRatedFights("regular")).resolves.toBe(4);
		await expect(LogsKingGuardFightsRequests.countRatedFights("stranger")).resolves.toBe(0);
	});

	it("counts only today's guard fights in the daily summary", async () => {
		const player = await LogsPlayers.create({ keycloakId: "daily" });
		const today = dateToLogs(getTodayMidnight()) + 60;
		for (const winner of [KING_GUARD_FIGHT_WINNER.PLAYER, KING_GUARD_FIGHT_WINNER.DRAW, KING_GUARD_FIGHT_WINNER.GUARD]) {
			await logGuardFight({
				playerId: player.id, winner, date: today
			});
		}
		await logGuardFight({
			playerId: player.id, winner: KING_GUARD_FIGHT_WINNER.PLAYER, date: today - 2 * 86_400
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

	it("lists every guard of the library each player beat once, with the fight in which it first beat it", async () => {
		const player = await LogsPlayers.create({ keycloakId: "winner" });
		await logGuardFight({
			playerId: player.id, guardId: 5, winner: KING_GUARD_FIGHT_WINNER.GUARD, date: 900
		});
		await logGuardFight({
			playerId: player.id, guardId: 5, winner: KING_GUARD_FIGHT_WINNER.PLAYER, date: 1_000
		});
		await logGuardFight({
			playerId: player.id, guardId: 5, winner: KING_GUARD_FIGHT_WINNER.PLAYER, date: 2_000
		});
		await logGuardFight({
			playerId: player.id, guardId: null, winner: KING_GUARD_FIGHT_WINNER.PLAYER, date: 3_000
		});

		const victories = await LogsKingGuardFightsRequests.getVictories();

		expect(victories).toEqual([
			{
				keycloakId: "winner", guardId: 5, firstDate: 1_000, firstFightId: expect.any(Number)
			}
		]);
	});
});

describe("King guard fight stats", () => {
	const guardOf = (id: number): object => {
		const guard = KingGuardDataController.instance.getById(id)!;
		return {
			id, level: guard.level, classId: guard.classId
		};
	};

	it("returns null for a player who never fought a king guard", async () => {
		await LogsPlayers.create({ keycloakId: "neverFought" });

		expect(await getKingGuardFightStats({
			keycloakId: "neverFought", level: 120
		})).toBeNull();
	});

	it("shows the best guard beaten by its current rating, ranks the players by it, and follows the ratings when they move", async () => {
		const alice = await LogsPlayers.create({ keycloakId: "alice" });
		const bob = await LogsPlayers.create({ keycloakId: "bob" });
		await logGuardFight({
			playerId: alice.id, guardId: 1, winner: KING_GUARD_FIGHT_WINNER.PLAYER, date: 1_000
		});
		await logGuardFight({
			playerId: alice.id, guardId: 900, winner: KING_GUARD_FIGHT_WINNER.PLAYER, date: 1_100
		});
		await logGuardFight({
			playerId: alice.id, guardId: 1_200, winner: KING_GUARD_FIGHT_WINNER.GUARD, date: 1_200
		});
		await logGuardFight({
			playerId: bob.id, guardId: 500, winner: KING_GUARD_FIGHT_WINNER.PLAYER, date: 1_050
		});
		await setGuardGlories({
			1: 1_200, 500: 2_400, 900: 2_600, 1_200: 3_000
		});

		expect(await getKingGuardFightStats({
			keycloakId: "alice", level: 150
		})).toEqual({
			won: 2,
			lost: 1,
			draw: 0,
			playerLevel: 150,
			record: {
				guard: guardOf(900), rank: 1, challengers: 2
			},
			leaderboard: [
				{
					keycloakId: "alice", guard: guardOf(900)
				},
				{
					keycloakId: "bob", guard: guardOf(500)
				}
			]
		});

		// The guard bob beat wins fights and climbs above the best guard of alice
		await setGuardGlories({ 500: 2_700 });
		expect((await getKingGuardFightStats({
			keycloakId: "alice", level: 150
		}))?.record).toEqual({
			guard: guardOf(900), rank: 2, challengers: 2
		});

		// The weakest guard alice beat climbs above all the others: it becomes her best guard
		await setGuardGlories({ 1: 2_800 });
		expect((await getKingGuardFightStats({
			keycloakId: "alice", level: 150
		}))?.record).toEqual({
			guard: guardOf(1), rank: 1, challengers: 2
		});
	});

	it("counts the fights against the guards generated before the library in the tally, but not in the record", async () => {
		const veteran = await LogsPlayers.create({ keycloakId: "veteran" });
		await logGuardFight({
			playerId: veteran.id, winner: KING_GUARD_FIGHT_WINNER.PLAYER, date: 1_000
		});
		await logGuardFight({
			playerId: veteran.id, winner: KING_GUARD_FIGHT_WINNER.DRAW, date: 1_100
		});

		expect(await getKingGuardFightStats({
			keycloakId: "veteran", level: 150
		})).toEqual({
			won: 1,
			lost: 0,
			draw: 1,
			playerLevel: 150,
			leaderboard: []
		});
	});

	it("keeps only the best challengers in the leaderboard, while ranking the player among all of them", async () => {
		const size = FightConstants.KING_GUARD.LEADERBOARD_SIZE;
		for (let index = 0; index <= size; index++) {
			const challenger = await LogsPlayers.create({ keycloakId: `challenger${index}` });
			await logGuardFight({
				playerId: challenger.id, guardId: index + 1, winner: KING_GUARD_FIGHT_WINNER.PLAYER, date: 1_000 + index
			});
			await setGuardGlories({ [index + 1]: 2_000 - index });
		}

		const stats = await getKingGuardFightStats({
			keycloakId: `challenger${size}`, level: 150
		});

		expect(stats?.leaderboard.map(challenger => challenger.keycloakId)).toEqual(
			Array.from({ length: size }, (_, index) => `challenger${index}`)
		);
		expect(stats?.record).toMatchObject({
			rank: size + 1, challengers: size + 1
		});
	});
});
