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
		reporters: [
			"default",
			["junit", { outputFile: "test-integration-results.xml" }]
		]
	}
});
