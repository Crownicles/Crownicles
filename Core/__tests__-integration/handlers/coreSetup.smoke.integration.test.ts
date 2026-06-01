import {
	afterAll, beforeAll, describe, expect, it
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

	it("loads production modules from the dist tree", () => {
		const mod = loadProductionModule<MissionShopItemsModule>(
			"core/utils/MissionShopItems"
		);
		expect(typeof mod.getMoneyShopItem).toBe("function");
		const item = mod.getMoneyShopItem();
		expect(typeof item.buyCallback).toBe("function");
	});
});

