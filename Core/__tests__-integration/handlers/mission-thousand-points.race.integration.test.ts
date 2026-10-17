import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";

type MissionShopItemsModule = typeof import("../../src/core/utils/MissionShopItems");

const N_CONCURRENT = 30;

/**
 * Race test for {@link MissionShopItemsModule.getAThousandPointsShopItem}'s
 * `buyCallback`. Production invariant (fixed by #3760): the
 * `hasBoughtPointsThisWeek` check and the score award + flag flip
 * happen inside a single `withLockedEntitiesSafe([Player,
 * PlayerMissionsInfo])`. Without the lock, two concurrent buys could
 * both observe `hasBoughtPointsThisWeek = false` and double-award the
 * score. After the fix, racing N callers must result in EXACTLY ONE
 * fulfilled call returning true, EXACTLY ONE score award, and the
 * flag set to true.
 */
describe("MissionShopItems.getAThousandPointsShopItem race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let missionShopItems: MissionShopItemsModule;

	beforeAll(async () => {
		env = await setupCoreForTests("missionthousandpoints");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		missionShopItems = loadProductionModule<MissionShopItemsModule>(
			"core/utils/MissionShopItems"
		);
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
	});

	it(`awards score exactly once when ${N_CONCURRENT} callers race`, async () => {
		const player = await Player.create({
			keycloakId: "race-thousand-points",
			score: 0
		});
		await PlayerMissionsInfo.create({
			playerId: player.id,
			hasBoughtPointsThisWeek: false
		});

		const item = missionShopItems.getAThousandPointsShopItem();

		const values = await runAllOrThrow(
			Array.from({ length: N_CONCURRENT }, () => item.buyCallback([], player.id))
		);

		const successes = values.filter(v => v === true).length;
		// Exactly one race winner.
		expect(successes).toBe(1);

		const freshInfo = await PlayerMissionsInfo.findByPk(player.id);
		expect(freshInfo).toBeTruthy();
		expect(freshInfo!.hasBoughtPointsThisWeek).toBe(true);

		const fresh = await Player.findByPk(player.id);
		expect(fresh).toBeTruthy();
		// Score was awarded exactly once.
		// We don't assert the exact value here (level computation can
		// shift score handling), but we DO assert it's strictly less
		// than two awards.
		const oneAward = fresh!.score;
		expect(oneAward).toBeGreaterThan(0);
		expect(oneAward).toBeLessThan(2 * 1000);
	});
});
