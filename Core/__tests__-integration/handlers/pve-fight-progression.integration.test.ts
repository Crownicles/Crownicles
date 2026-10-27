import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import {
	IntegrationTestEnvironment, setupIntegrationDb
} from "../_setup";
import {
	initModel as initLogsPlayers, LogsPlayers
} from "../../src/core/database/logs/models/LogsPlayers";
import {
	initModel as initPveResults, LogsPveFightsResults, PVE_FIGHT_WINNER
} from "../../src/core/database/logs/models/LogsPveFightsResults";
import { LogsPveFightProgressionRequests } from "../../src/core/database/logs/requests/LogsPveFightProgressionRequests";
import { ClassConstants } from "../../../Lib/src/constants/ClassConstants";

const PLAYER_KEYCLOAK_ID = "pve-progression-player";
const MONSTER_ID = "yukiOnna";

let env: IntegrationTestEnvironment;
let playerId: number;
let nextDate = 1_000;

async function logFight(params: {
	winner: number;
	classId?: number;
	monsterId?: string;
	monsterLevel?: number;
	playerLevel?: number;
}): Promise<void> {
	await LogsPveFightsResults.create({
		playerId,
		classId: params.classId ?? ClassConstants.CLASSES_ID.TANK,
		monsterId: params.monsterId ?? MONSTER_ID,
		monsterLevel: params.monsterLevel ?? 50,
		monsterFightPoints: 1_000,
		monsterAttack: 100,
		monsterDefense: 100,
		monsterSpeed: 100,
		turn: 5,
		winner: params.winner,
		playerLevel: params.playerLevel ?? null,
		date: nextDate++
	});
}

beforeAll(async () => {
	env = await setupIntegrationDb("pve_fight_progression");
	initLogsPlayers(env.sequelize);
	initPveResults(env.sequelize);
	await env.sequelize.sync();
}, 60_000);

afterAll(async () => {
	await env?.teardown();
}, 60_000);

beforeEach(async () => {
	await LogsPveFightsResults.destroy({ where: {}, truncate: true });
	await LogsPlayers.destroy({ where: {} });
	playerId = (await LogsPlayers.create({ keycloakId: PLAYER_KEYCLOAK_ID })).id;
});

describe("PVE boss ladder", () => {
	function getLadder(): ReturnType<typeof LogsPveFightProgressionRequests.getBossLadder> {
		return LogsPveFightProgressionRequests.getBossLadder({
			playerKeycloakId: PLAYER_KEYCLOAK_ID,
			monsterId: MONSTER_ID
		});
	}

	it("is empty when the player never fought the boss", async () => {
		await logFight({
			winner: PVE_FIGHT_WINNER.PLAYER, monsterId: "crocodile", monsterLevel: 70
		});

		await expect(getLadder()).resolves.toEqual({
			strongestVictoryLevel: null, lastFight: null
		});
	});

	it("remembers the strongest boss killed whatever the class, and the last fight against it", async () => {
		await logFight({
			winner: PVE_FIGHT_WINNER.PLAYER, monsterLevel: 45, classId: ClassConstants.CLASSES_ID.HELMETED
		});
		await logFight({
			winner: PVE_FIGHT_WINNER.PLAYER, monsterLevel: 52, classId: ClassConstants.CLASSES_ID.PALADIN
		});
		await logFight({
			winner: PVE_FIGHT_WINNER.PLAYER, monsterLevel: 70, monsterId: "crocodile"
		});
		await logFight({
			winner: PVE_FIGHT_WINNER.MONSTER, monsterLevel: 58, playerLevel: 74
		});

		await expect(getLadder()).resolves.toEqual({
			strongestVictoryLevel: 52,
			lastFight: {
				level: 58, isDefeat: true, playerLevel: 74
			}
		});
	});
});
