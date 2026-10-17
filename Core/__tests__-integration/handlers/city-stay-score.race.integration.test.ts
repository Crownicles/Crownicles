import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, pinInertDailyMission, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";
import type { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";

type CityStayScoreModule = typeof import("../../src/core/report/ReportCityStayScoreService");
type PlayerLockModule = typeof import("../../src/core/utils/withLockedPlayerAndMissions");

const N_CONCURRENT = 10;
const STAY_MINUTES = 120;
const ONE_MINUTE_MS = 60_000;

/**
 * Leaving a city credits the points of the stay once: the credit, the exit and the
 * reset of the arrival date are committed together under the player lock, so racing
 * exits (double click, retried delivery) cannot pay the same stay twice.
 */
describe("City stay score on exit", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let cityStayScore: CityStayScoreModule;
	let playerLock: PlayerLockModule;

	beforeAll(async () => {
		env = await setupCoreForTests("citystayscore");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		cityStayScore = loadProductionModule<CityStayScoreModule>("core/report/ReportCityStayScoreService");
		playerLock = loadProductionModule<PlayerLockModule>("core/utils/withLockedPlayerAndMissions");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await PlayerMissionsInfo.destroy({ truncate: true, force: true });
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
		await pinInertDailyMission(env);
	});

	async function createPlayerInCity(keycloakId: string): Promise<PlayerType> {
		const player = await Player.create({
			keycloakId,
			score: 0,
			insideCity: true,
			cityArrivalDate: new Date(Date.now() - STAY_MINUTES * ONE_MINUTE_MS)
		});
		await PlayerMissionsInfo.create({ playerId: player.id });
		return player;
	}

	function leaveCity(playerId: number): Promise<number> {
		return playerLock.withLockedPlayerAndMissions(playerId, lockedPlayer => {
			const response: CrowniclesPacket[] = [];
			return cityStayScore.leaveCityUnderLock(lockedPlayer, response, new Date());
		});
	}

	it("credits the stay with the report algorithm and leaves the city", async () => {
		const player = await createPlayerInCity("city-stay-score");

		const credited = await leaveCity(player.id);

		// One point per minute plus a random bonus of at most a sixth of it, blessing excluded
		expect(credited).toBeGreaterThanOrEqual(STAY_MINUTES);
		const fresh = await Player.findByPk(player.id);
		expect(fresh!.score).toBe(credited);
		expect(fresh!.insideCity).toBe(false);
		expect(fresh!.cityArrivalDate).toBeNull();
	});

	it(`credits the stay exactly once when ${N_CONCURRENT} exits race`, async () => {
		const player = await createPlayerInCity("city-stay-score-race");

		const credits = await runAllOrThrow(Array.from({ length: N_CONCURRENT }, () => leaveCity(player.id)));

		expect(credits.filter(credit => credit > 0)).toHaveLength(1);
		const fresh = await Player.findByPk(player.id);
		expect(fresh!.score).toBe(credits.reduce((sum, credit) => sum + credit, 0));
		expect(fresh!.insideCity).toBe(false);
		expect(fresh!.cityArrivalDate).toBeNull();
	});
});
