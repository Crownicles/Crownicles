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
 */
export default defineConfig({
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
