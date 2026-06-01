import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, runAllOrThrow, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";

type WithLockedPlayerSafeModule = typeof import("../../src/core/utils/withLockedPlayerSafe");

const N_CONCURRENT = 30;

/**
 * Race tests for the {@link WithLockedPlayerSafeModule.withLockedPlayerSafe}
 * primitive. The helper is the row-level lock entry point used by every
 * fire-and-forget small-event / fight callback, so it has two
 * invariants worth exercising:
 *
 * 1. Concurrent successful invocations against the same player produce
 *    no lost writes — every body increment must land.
 * 2. When the locked row vanishes between dispatch and lock
 *    acquisition (player wiped by /reset, /admin reset, etc.), the
 *    `LockedRowNotFoundError` is swallowed and the body is skipped
 *    instead of bubbling up to the caller's fire-and-forget context.
 */
describe("withLockedPlayerSafe race", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let mod: WithLockedPlayerSafeModule;

	beforeAll(async () => {
		env = await setupCoreForTests("withlockedplayersafe");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		mod = loadProductionModule<WithLockedPlayerSafeModule>("core/utils/withLockedPlayerSafe");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	beforeEach(async () => {
		await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
		try {
			await Player.destroy({ truncate: true, force: true });
		}
		finally {
			await env.crownicles.gameDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
		}
	});

	it(`serialises ${N_CONCURRENT} concurrent body executions — no lost writes`, async () => {
		const player = await Player.create({
			keycloakId: "race-with-locked-safe-no-lost",
			money: 0
		});

		await runAllOrThrow(
			Array.from({ length: N_CONCURRENT }, async () => {
				const stale = await Player.findByPk(player.id);
				await mod.withLockedPlayerSafe(stale!, "race test", async lockedPlayer => {
					lockedPlayer.money += 1;
					await lockedPlayer.save();
				});
			})
		);

		const fresh = await Player.findByPk(player.id);
		expect(fresh).toBeTruthy();
		expect(fresh!.money).toBe(N_CONCURRENT);
	});

	it("swallows LockedRowNotFoundError when the player vanished concurrently", async () => {
		const player = await Player.create({
			keycloakId: "race-with-locked-safe-vanished",
			money: 0
		});
		const staleRef = await Player.findByPk(player.id);
		expect(staleRef).toBeTruthy();

		// Destroy the row before the lock body has a chance to run, then call
		// withLockedPlayerSafe with the stale reference. The helper must
		// downgrade the resulting LockedRowNotFoundError to a warning instead
		// of propagating.
		await Player.destroy({ where: { id: player.id } });

		let bodyRan = false;
		await expect(
			mod.withLockedPlayerSafe(staleRef!, "race test vanished", async lockedPlayer => {
				bodyRan = true;
				lockedPlayer.money += 1;
				await lockedPlayer.save();
			})
		).resolves.toBeUndefined();
		expect(bodyRan).toBe(false);
	});
});
