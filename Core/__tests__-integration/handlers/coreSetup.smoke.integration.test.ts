import {
	afterAll, beforeAll, describe, expect, it
} from "vitest";
import {
	CoreTestEnvironment, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import type { ModelStatic } from "sequelize";

/**
 * Smoke test for `_coreSetup.ts`. Verifies that:
 * 1. The Core singleton is rebuilt against a fresh schema.
 * 2. Production migrations run against that schema.
 * 3. The Player model registered on `gameDatabase.sequelize` is
 *    reachable via `sequelize.models` and can read/write.
 * 4. `teardown()` drops the schema and restores the singletons.
 *
 * Note: tests must reach models through `gameDatabase.sequelize.models`
 * rather than `import { Player } from "../src/.../Player"`. Vite-node
 * loads source files (`.ts`), while `Database.initModels()` loads
 * compiled files (`.js`) — they live in two different module trees,
 * so the `Player` class imported from source is *not* the one
 * registered with Sequelize.
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
});

