import { createConnection } from "mariadb";
import {
	botConfig, setBotConfigForTests
} from "../src/bootstrap";
import {
	crowniclesInstance, setCrowniclesInstanceForTests
} from "../src/app";
import { Crownicles } from "../src/core/bot/Crownicles";
import { createMqttPrefix } from "../../Lib/src/utils/MqttTopicUtils";
import {
	CrowniclesConfig
} from "../src/core/bot/CrowniclesConfig";
import { getIntegrationDbConfig } from "./_setup";

/**
 * Live Core environment for integration tests. Holds the rebuilt
 * `Crownicles` singleton (game database, packet listener) and a
 * `teardown()` that closes connections, drops the test schema and
 * restores the production singletons so other suites are unaffected.
 */
export interface CoreTestEnvironment {
	crownicles: Crownicles;
	prefix: string;
	teardown: () => Promise<void>;
}

/**
 * Build a noop LogsDatabase replacement. All `log*` methods become
 * fire-and-forget no-ops so race tests don't have to provision a
 * second schema for log models. Any unexpected call throws so missing
 * coverage is loud rather than silent.
 */
function createNoopLogsDatabase(): unknown {
	return new Proxy({}, {
		get(_target, prop: string | symbol) {
			if (typeof prop !== "string") {
				return undefined;
			}
			if (prop === "then") {
				// Avoid being mis-detected as a thenable by callers.
				return undefined;
			}
			return (): Promise<void> => Promise.resolve();
		}
	});
}

/**
 * Spin up a real Core instance for integration tests.
 *
 * Provisioning steps:
 * 1. Override {@link botConfig} so {@link GameDatabase} targets a fresh
 *    per-suite schema (`crownicles_test_<suite>_<pid>_<rand>_game`).
 * 2. Build a new {@link Crownicles} instance under the test config and
 *    install it as the global singleton via
 *    {@link setCrowniclesInstanceForTests}.
 * 3. Connect & migrate the game database. The logs database is replaced
 *    with a noop proxy because no test currently exercises log writes.
 *
 * The returned `teardown()` is idempotent: it closes the Sequelize
 * pool, drops the schema with the root credentials from `_setup.ts`,
 * restores the production singletons and clears the config override.
 *
 * ### Known limitation (issue #4265 follow-up)
 *
 * `GameDatabase.init` resolves its models/migrations folder via
 * `__dirname` and only loads `*.js` files (see
 * `Lib/src/database/Database.ts#initModelFromFile`). When Vitest loads
 * `GameDatabase.ts` from source, `__dirname` points at the source tree
 * which only contains `.ts` files. Race tests must therefore either:
 *   - run after `pnpm tsc` has produced `dist/`, plus a small env-var
 *     override in `GameDatabase` to point at `dist/Core/.../game`, or
 *   - bypass {@link GameDatabase.init} and define their own models /
 *     run migrations manually.
 *
 * The dist-based approach is tracked separately and is the next step
 * before race tests can use this helper.
 */
export async function setupCoreForTests(suiteName: string): Promise<CoreTestEnvironment> {
	const dbConfig = getIntegrationDbConfig();
	const safeSuite = suiteName.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24);
	const prefix = `crownicles_test_${safeSuite}_${process.pid}_${Math.floor(Math.random() * 0xFFFFFFFF).toString(16)}`;

	const testConfig: CrowniclesConfig = {
		MODE_MAINTENANCE: false,
		TEST_MODE: true,
		PREFIX: createMqttPrefix(prefix),
		MARIADB_HOST: dbConfig.host,
		MARIADB_USER: dbConfig.user,
		MARIADB_PASSWORD: dbConfig.password,
		MARIADB_ROOT_PASSWORD: dbConfig.rootPassword,
		MARIADB_PORT: dbConfig.port,
		MQTT_HOST: "mqtt://127.0.0.1",
		WEB_SERVER_PORT: 0,
		LOG_LEVEL: "error",
		LOG_LOCATIONS: ["console"]
	};

	setBotConfigForTests(testConfig);

	const testInstance = new Crownicles();
	await testInstance.gameDatabase.init(true);

	// Replace the logs database with a noop proxy. `logsDatabase` is
	// declared `readonly` for production safety, so the cast is the
	// narrowest possible escape hatch.
	(testInstance as unknown as { logsDatabase: unknown }).logsDatabase = createNoopLogsDatabase();

	setCrowniclesInstanceForTests(testInstance);

	let toreDown = false;
	return {
		crownicles: testInstance,
		prefix,
		async teardown(): Promise<void> {
			if (toreDown) {
				return;
			}
			toreDown = true;
			try {
				await testInstance.gameDatabase.sequelize.close();
			}
			catch {
				// Already closed — ignore.
			}
			// Drop the per-suite schema using the root credentials so
			// the dev MariaDB doesn't accumulate leftover schemas.
			const adminConn = await createConnection({
				host: dbConfig.host,
				port: dbConfig.port,
				user: dbConfig.rootUser,
				password: dbConfig.rootPassword
			});
			try {
				await adminConn.query(`DROP DATABASE IF EXISTS \`${prefix}_game\`;`);
			}
			finally {
				await adminConn.end();
			}
			setCrowniclesInstanceForTests(null);
			setBotConfigForTests(null);
		}
	};
}

// Re-export for convenience so test files can grab the active instance
// without juggling two imports.
export { botConfig, crowniclesInstance };
