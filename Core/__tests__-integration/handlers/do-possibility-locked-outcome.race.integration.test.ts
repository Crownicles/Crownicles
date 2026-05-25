import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { PlayerMissionsInfo as PlayerMissionsInfoType } from "../../src/core/database/game/models/PlayerMissionsInfo";

type LocksModule = typeof import("../../../Lib/src/locks/withLockedEntities");
type PlayerModelModule = typeof import("../../src/core/database/game/models/Player");
type MissionsInfoModelModule = typeof import("../../src/core/database/game/models/PlayerMissionsInfo");

const N_CONCURRENT = 20;
const MONEY_DELTA = 10;

/**
 * Race coverage for the `applyLockedOutcomeUnderLock` body in
 * {@link ReportBigEventService.doPossibility}: race N concurrent
 * outcome applications under
 * `withLockedEntities([Player, PlayerMissionsInfo])` and assert that
 * every money delta lands (no lost writes), which mirrors the safety
 * invariant of `#3760` — the bug that motivated wrapping the outcome
 * application in a row-level lock in the first place.
 *
 * We deliberately stay close to the production helper without dragging
 * in BigEvent / Possibility / random-outcome fixtures: the property we
 * care about is "the lock around `addMoney` + `save` on the player
 * row, while also holding the missions-info row, serialises writes
 * across concurrent doPossibility callers".
 */
describe("doPossibility locked outcome race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let PlayerMissionsInfo: ModelStatic<PlayerMissionsInfoType>;
	let locks: LocksModule;
	let playerMod: PlayerModelModule;
	let missionsInfoMod: MissionsInfoModelModule;

	beforeAll(async () => {
		env = await setupCoreForTests("dopossibilitylock");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		PlayerMissionsInfo = env.crownicles.gameDatabase.sequelize.models.PlayerMissionsInfo as ModelStatic<PlayerMissionsInfoType>;
		locks = loadProductionModule<LocksModule>("../../Lib/src/locks/withLockedEntities");
		playerMod = loadProductionModule<PlayerModelModule>("core/database/game/models/Player");
		missionsInfoMod = loadProductionModule<MissionsInfoModelModule>("core/database/game/models/PlayerMissionsInfo");
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

	it(`serialises ${N_CONCURRENT} concurrent outcome applications — money is exact`, async () => {
		const player = await Player.create({
			keycloakId: "race-do-possibility-money",
			money: 0
		});
		// Pre-create the missions-info row so the lock body does not
		// race an INSERT, exactly as `doPossibility` does via
		// `PlayerMissionsInfos.getOfPlayer` before entering the lock.
		await PlayerMissionsInfo.create({ playerId: player.id });

		await runAllOrThrow(
			Array.from({ length: N_CONCURRENT }, () => locks.withLockedEntities(
				[
					playerMod.Player.lockKey(player.id),
					missionsInfoMod.PlayerMissionsInfo.lockKey(player.id)
				] as const,
				async ([lockedPlayer]) => {
					lockedPlayer.money += MONEY_DELTA;
					lockedPlayer.nextEvent = null;
					await lockedPlayer.save();
				}
			))
		);

		const fresh = await Player.findByPk(player.id);
		expect(fresh).toBeTruthy();
		expect(fresh!.money).toBe(N_CONCURRENT * MONEY_DELTA);
		expect(fresh!.nextEvent).toBeNull();
	});
});
