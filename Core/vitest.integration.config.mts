import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

/**
 * Dedicated Vitest configuration for integration tests.
 *
 * - Picks up only files under `__tests__-integration/`.
 * - Generous timeouts because each suite spins up a fresh MariaDB schema
 *   (CREATE DATABASE + sync) and tears it down at the end.
 * - Runs suites sequentially (`fileParallelism: false`) so two tests
 *   never compete for the same connection pool when MariaDB has a low
 *   `max_connections` ceiling on a developer's local instance.
 *
 * Resolve aliases force a single physical copy of `sequelize` and
 * `cls-hooked`. Production runs Lib's compiled output from inside
 * `Core/dist/Lib/`, where every `require("sequelize")` resolves to
 * `Core/node_modules/sequelize`. Vite-node loads Lib's source files
 * directly from `Lib/src`, which would otherwise pull in a second
 * physical `sequelize` copy from `Lib/node_modules` — breaking model
 * identity (the `Player` model registered on Core's Sequelize would
 * never be reachable from `gameDatabase.sequelize`).
 */
const coreNodeModules = fileURLToPath(new URL("./node_modules", import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			sequelize: `${coreNodeModules}/sequelize`,
			"cls-hooked": `${coreNodeModules}/cls-hooked`
		}
	},
	test: {
		environment: "node",
		globals: true,
		include: ["__tests__-integration/**/*.test.ts"],
		exclude: ["node_modules/**", "dist/**"],
		testTimeout: 30_000,
		hookTimeout: 60_000,
		fileParallelism: false,
		/*
		 * Force every production module — and every shared singleton it
		 * leans on — through Node's native CJS loader instead of
		 * vite-node's transformer. Without this, vite-node maintains its
		 * own module cache for `dist/**` files and database/sequelize
		 * deps, so the `Player` class that `GameDatabase.initModels()`
		 * registers on the Sequelize instance ends up being a different
		 * class instance from the one referenced inside the production
		 * `MissionShopItems.js` (and friends) — and `Player.lockKey(...)`
		 * inside the locked critical sections sees a Player whose
		 * `.sequelize` is undefined. Externalising `dist/**`, sequelize,
		 * cls-hooked and mariadb collapses everything into a single
		 * Node CJS cache that matches production semantics.
		 */
		server: {
			deps: {
				external: [
					/[\\/]Core[\\/]dist[\\/]/,
					/[\\/]Lib[\\/]dist[\\/]/,
					"sequelize",
					"cls-hooked",
					"mariadb",
					"moment"
				]
			}
		},
		reporters: [
			"default",
			["junit", { outputFile: "test-integration-results.xml" }]
		]
	}
});
