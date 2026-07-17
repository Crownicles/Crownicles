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
	initModel as initPveResults, LogsPveFightsResults
} from "../../src/core/database/logs/models/LogsPveFightsResults";
import {
	initModel as initPveActionsUsed, LogsPveFightsActionsUsed
} from "../../src/core/database/logs/models/LogsPveFightsActionsUsed";
import {
	initModel as initFightActions, LogsFightsActions
} from "../../src/core/database/logs/models/LogsFightsActions";
import { LogsPveBossRecordsRequests } from "../../src/core/database/logs/requests/LogsPveBossRecordsRequests";
import {
	down as removeBossRecordIndexes, up as addBossRecordIndexes
} from "../../src/core/database/logs/migrations/032-pve-boss-record-indexes";

let env: IntegrationTestEnvironment;

async function createFight(params: {
	playerId: number;
	monsterId?: string;
	monsterLevel: number;
	turns: number;
	date: number;
	classId: number;
	actionName: string;
	actionCount?: number;
}): Promise<number> {
	const action = await LogsFightsActions.create({
		name: params.actionName,
		classId: params.classId
	});
	const fight = await LogsPveFightsResults.create({
		playerId: params.playerId,
		monsterId: params.monsterId ?? "magmaTitan",
		monsterLevel: params.monsterLevel,
		monsterFightPoints: 1_000,
		monsterAttack: 100,
		monsterDefense: 100,
		monsterSpeed: 100,
		turn: params.turns,
		winner: 1,
		date: params.date
	});
	await LogsPveFightsActionsUsed.create({
		pveFightId: fight.id,
		actionId: action.id,
		count: params.actionCount ?? 1
	});
	return fight.id;
}

beforeAll(async () => {
	env = await setupIntegrationDb("pve_boss_records");
	initLogsPlayers(env.sequelize);
	initPveResults(env.sequelize);
	initPveActionsUsed(env.sequelize);
	initFightActions(env.sequelize);
	await env.sequelize.sync();
	await addBossRecordIndexes({ context: env.sequelize.getQueryInterface() });
}, 60_000);

afterAll(async () => {
	if (env) {
		await removeBossRecordIndexes({ context: env.sequelize.getQueryInterface() });
		await env.teardown();
	}
}, 60_000);

beforeEach(async () => {
	await LogsPveFightsActionsUsed.destroy({ where: {}, truncate: true });
	await LogsPveFightsResults.destroy({ where: {}, truncate: true });
	await LogsFightsActions.destroy({ where: {}, truncate: true });
	await LogsPlayers.destroy({ where: {}, truncate: true });
});

describe("PvE boss record queries", () => {
	it("installs every index required by the archivist queries", async () => {
		const queryInterface = env.sequelize.getQueryInterface() as QueryInterface;
		const playerIndexes = await queryInterface.showIndex("players");
		const resultIndexes = await queryInterface.showIndex("pve_fights_results");
		const actionIndexes = await queryInterface.showIndex("pve_fights_actions_used");

		expect(playerIndexes.map(index => index.name)).toContain("idx_players_keycloak");
		expect(resultIndexes.map(index => index.name)).toEqual(expect.arrayContaining([
			"idx_pve_player_winner_monster",
			"idx_pve_monster_winner_record"
		]));
		expect(actionIndexes.map(index => index.name)).toContain("idx_pve_fight_action");
	});

	it("returns personal records with the winning fight actions", async () => {
		const player = await LogsPlayers.create({ keycloakId: "personal-player" });
		await createFight({
			playerId: player.id,
			monsterLevel: 100,
			turns: 8,
			date: 1_000,
			classId: 3,
			actionName: "quickAttack",
			actionCount: 4
		});
		await createFight({
			playerId: player.id,
			monsterLevel: 110,
			turns: 12,
			date: 1_100,
			classId: 18,
			actionName: "powerfulAttack",
			actionCount: 2
		});
		await createFight({
			playerId: player.id,
			monsterId: "kraken",
			monsterLevel: 90,
			turns: 15,
			date: 1_200,
			classId: 19,
			actionName: "shieldAttack"
		});

		await expect(LogsPveBossRecordsRequests.getPersonalRecords("personal-player")).resolves.toEqual([
			expect.objectContaining({
				monsterId: "magmaTitan",
				monsterLevel: 110,
				classId: 18,
				actions: [{
					actionId: "powerfulAttack", count: 2
				}]
			}),
			expect.objectContaining({
				monsterId: "kraken",
				monsterLevel: 90,
				classId: 19
			})
		]);
	});

	it("deduplicates players and ranks only the requested maximum-tier class", async () => {
		vi.spyOn(LogsPveBossRecordsRequests, "getMaximumTierClassIds").mockReturnValue([18]);
		const duplicateA = await LogsPlayers.create({ keycloakId: "duplicate-player" });
		const duplicateB = await LogsPlayers.create({ keycloakId: "duplicate-player" });
		const champion = await LogsPlayers.create({ keycloakId: "champion" });
		const lowerClass = await LogsPlayers.create({ keycloakId: "lower-class" });

		await createFight({
			playerId: duplicateA.id, monsterLevel: 100, turns: 10, date: 1_000, classId: 18, actionName: "attack-a"
		});
		await createFight({
			playerId: duplicateB.id, monsterLevel: 110, turns: 10, date: 1_000, classId: 18, actionName: "attack-b"
		});
		await createFight({
			playerId: champion.id, monsterLevel: 120, turns: 12, date: 1_000, classId: 18, actionName: "attack-c"
		});
		await createFight({
			playerId: lowerClass.id, monsterLevel: 130, turns: 5, date: 1_000, classId: 3, actionName: "attack-d"
		});

		const leaderboard = await LogsPveBossRecordsRequests.getLeaderboard("magmaTitan", 18);

		expect(leaderboard.map(entry => [entry.playerKeycloakId, entry.monsterLevel])).toEqual([
			["champion", 120],
			["duplicate-player", 110]
		]);
	});
});
