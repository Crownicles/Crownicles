import {
	afterAll, beforeAll, describe, expect, it, vi
} from "vitest";
import type { ModelStatic } from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";

type MissionShopItemsModule = typeof import("../../src/core/utils/MissionShopItems");

/**
 * Smoke test for `_coreSetup.ts`. Verifies that:
 * 1. The Core singleton is rebuilt against a fresh schema and
 *    migrations run.
 * 2. The Player model registered on `gameDatabase.sequelize` is
 *    reachable via `sequelize.models` and can read/write.
 * 3. `loadProductionModule` returns a usable compiled production
 *    module from `dist/`.
 * 4. `teardown()` drops the schema and restores the singletons.
 */
describe("setupCoreForTests smoke", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;

	beforeAll(async () => {
		env = await setupCoreForTests("smoke");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
	});

	afterAll(async () => {
		await env?.teardown();
	});

	it("provisions a schema and exposes a working Sequelize instance", () => {
		expect(env.crownicles.gameDatabase.sequelize).toBeTruthy();
		expect(env.prefix).toMatch(/^crownicles_test_smoke_/);
	});

	it("can create and re-read a Player row through the registered model", async () => {
		const created = await Player.create({ keycloakId: "smoke-test-player" });
		const fetched = await Player.findOne({ where: { keycloakId: "smoke-test-player" } });
		expect(fetched?.id).toBe(created.id);
	});

	it("registers only one character when several first requests arrive together", async () => {
		const Players = loadProductionModule<typeof import("../../src/core/database/game/models/Player")>("core/database/game/models/Player").Players;
		const keycloakId = "simultaneous-first-login";
		const ids = await Promise.all(Array.from({length: 6}, async () => {
			const existing = await Players.getByKeycloakId(keycloakId);
			return (existing ?? await Players.getOrRegister(keycloakId)).id;
		}));
		expect(new Set(ids).size).toBe(1);
		expect(await Player.count({where: {keycloakId}})).toBe(1);
	});

	it("can retry registration after the first attempt fails", async () => {
		const Players = loadProductionModule<typeof import("../../src/core/database/game/models/Player")>("core/database/game/models/Player").Players;
		const keycloakId = "failed-first-login";
		const findOrCreate = vi.spyOn(Player, "findOrCreate").mockRejectedValueOnce(new Error("registration failed"));
		try {
			const attempts = await Promise.allSettled([
				Players.getOrRegister(keycloakId),
				Players.getOrRegister(keycloakId)
			]);
			expect(attempts.map(attempt => attempt.status)).toEqual(["rejected", "rejected"]);
			expect(findOrCreate).toHaveBeenCalledTimes(1);
		}
		finally {
			findOrCreate.mockRestore();
		}

		await Players.getOrRegister(keycloakId);
		expect(await Player.count({where: {keycloakId}})).toBe(1);
	});

	it("loads production modules from the dist tree", () => {
		const mod = loadProductionModule<MissionShopItemsModule>(
			"core/utils/MissionShopItems"
		);
		expect(typeof mod.getMoneyShopItem).toBe("function");
		const item = mod.getMoneyShopItem();
		expect(typeof item.buyCallback).toBe("function");
	});
});

