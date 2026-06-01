import { createConnection } from "mariadb";
import { createRequire } from "module";
import { resolve as resolvePath } from "path";
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
import { CrowniclesLogger } from "../../Lib/src/logs/CrowniclesLogger";
import { CoreConstants } from "../src/core/CoreConstants";
import type { LogsDatabase } from "../src/core/database/logs/LogsDatabase";
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
 * Build a noop LogsDatabase replacement. Every accessed property
 * resolves to a fire-and-forget async no-op so race tests don't have
 * to provision a second schema for log models.
 */
function createNoopLogsDatabase(): LogsDatabase {
	return new Proxy({} as LogsDatabase, {
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
 * CJS `require` rooted at this test file, used to load production
 * modules straight from the compiled `dist/` tree.
 *
 * Why Node CJS instead of `await import(...)`?
 * - vite-node maintains its own module cache, separate from Node's.
 *   `GameDatabase.initModels()` dynamic-imports model files via
 *   `await import(...)` inside Lib's compiled code, which vite-node
 *   transforms and serves from its own cache. If the tests then load
 *   `MissionShopItems` through vite-node as well, the `Player` class
 *   referenced inside the production module ends up being a different
 *   class instance from the one Sequelize knows about — and
 *   `Player.lockKey(...).model.sequelize` is undefined at runtime.
 * - The integration vitest config externalises `dist/**`, `sequelize`,
 *   `cls-hooked`, `mariadb` and `moment` (see
 *   `server.deps.external`). That forces vite-node's own dynamic
 *   imports of those modules to go through `createRequire` too. The
 *   combination means: a single Node CJS module cache holds the dist
 *   tree + every shared singleton, exactly mirroring production.
 */
const distRequire = createRequire(__filename);

/**
 * Load a compiled production module from the `dist/` tree.
 *
 * Example usage in a race test:
 *
 * ```ts
 * type MissionShopItemsModule = typeof import("../../src/core/utils/MissionShopItems");
 * const mod = loadProductionModule<MissionShopItemsModule>(
 *     "core/utils/MissionShopItems"
 * );
 * ```
 *
 * `relativeFromCoreSrc` is the path relative to `Core/src` (without
 * the `.js` suffix), e.g. `"core/utils/MissionShopItems"`.
 */
export function loadProductionModule<T>(relativeFromCoreSrc: string): T {
	const distRoot = resolvePath(__dirname, "../dist/Core/src");
	return distRequire(resolvePath(distRoot, `${relativeFromCoreSrc}.js`)) as T;
}

/**
 * Spin up a real Core instance for integration tests.
 *
 * Provisioning steps:
 * 1. Override {@link botConfig} so {@link GameDatabase} targets a fresh
 *    per-suite schema (`crownicles_test_<suite>_<pid>_<rand>_game`).
 * 2. Point `CROWNICLES_DB_BASE_DIR` at the compiled `dist/` tree so the
 *    production model/migration loader picks up the `.js` artifacts
 *    produced by `pnpm tsc` (Vitest can't load them from source — the
 *    loader filters on `.js` extension by design).
 * 3. Build a new {@link Crownicles} instance under the test config and
 *    install it as the global singleton via
 *    {@link setCrowniclesInstanceForTests}.
 * 4. Connect & migrate the game database. The logs database is replaced
 *    with a noop proxy because no test currently exercises log writes.
 *
 * The returned `teardown()` is idempotent: it closes the Sequelize
 * pool, drops the schema with the root credentials from `_setup.ts`,
 * restores the production singletons and clears the config override.
 */
let activeTestEnvironment = false;

export async function setupCoreForTests(suiteName: string): Promise<CoreTestEnvironment> {
	// Guard against a leaked state from a previous suite that forgot
	// its teardown. Failing fast here surfaces the missing teardown
	// rather than letting the next suite see a polluted singleton.
	// We can't rely on `botConfig.TEST_MODE` because a developer's
	// `config.toml` may legitimately set `test_mode = true` in
	// production-shaped config; we track suite ownership explicitly.
	if (activeTestEnvironment) {
		throw new Error(
			"setupCoreForTests called while a previous test config is still active. "
			+ "A prior suite likely forgot to call its teardown()."
		);
	}
	activeTestEnvironment = true;
	try {
		return await setupCoreForTestsImpl(suiteName);
	}
	catch (err) {
		activeTestEnvironment = false;
		throw err;
	}
}

async function setupCoreForTestsImpl(suiteName: string): Promise<CoreTestEnvironment> {
	const dbConfig = getIntegrationDbConfig();
	const safeSuite = suiteName.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24);
	const prefix = `crownicles_test_${safeSuite}_${process.pid}_${Math.floor(Math.random() * 0xFFFFFFFF).toString(16)}`;

	// Point the GameDatabase loader at the compiled artifacts. The
	// production loader only accepts `.js` files (see
	// `Lib/src/database/Database.ts#initModelFromFile`), so Vitest must
	// rely on the `dist/` build produced by `pretest:integration`.
	const distGameDir = resolvePath(__dirname, "../dist/Core/src/core/database/game");
	const previousDbBaseDir = process.env[CoreConstants.DB_BASE_DIR_ENV_VAR];
	process.env[CoreConstants.DB_BASE_DIR_ENV_VAR] = distGameDir;

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
		LOG_LOCATIONS: []
	};

	setBotConfigForTests(testConfig);

	// Re-init the shared logger to honour the test config. Bootstrap
	// initialises it once from `loadConfig()` at module load — before
	// our override — so without this call race tests inherit the
	// production DEBUG level with console+file transports, drowning
	// stdout in benign fire-and-forget noise (notification hooks
	// firing outside their original transaction). We give winston a
	// real console transport so it doesn't emit a "no transports"
	// warning, then silence the underlying logger.
	CrowniclesLogger.init(testConfig.LOG_LEVEL, ["console"], { app: "Core" });
	CrowniclesLogger.silenceForTests();
	// Same singleton lives twice once compiled — the dist tree imports
	// `Lib/src/logs/CrowniclesLogger` from its own copy under
	// `Core/dist/Lib/src/...`, so we must reset it through that path
	// too.
	const distLogger = loadProductionModule<{
		CrowniclesLogger: typeof CrowniclesLogger;
	}>("../../Lib/src/logs/CrowniclesLogger");
	distLogger.CrowniclesLogger.init(testConfig.LOG_LEVEL, ["console"], { app: "Core" });
	distLogger.CrowniclesLogger.silenceForTests();

	const testInstance = new Crownicles();
	await testInstance.gameDatabase.init(true);

	// Swap the logs database with a noop stub so race tests don't have
	// to provision a second schema for log models.
	testInstance.setLogsDatabaseForTests(createNoopLogsDatabase());

	setCrowniclesInstanceForTests(testInstance);

	// Also wire the dist-side `crowniclesInstance` so production code
	// loaded via `loadProductionModule` (which reads from dist's own
	// module cache) sees the test instance with the noop logsDatabase.
	// Otherwise the dist module keeps the real `new Crownicles()`
	// created at dist module load time and its uninitialised
	// LogsDatabase fires unhandled rejections from
	// `LogsPlayers.findOrCreate`.
	const distApp = loadProductionModule<{
		setCrowniclesInstanceForTests: (instance: Crownicles | null) => void;
	}>("app");
	distApp.setCrowniclesInstanceForTests(testInstance);

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
			try {
				const distApp = loadProductionModule<{
					setCrowniclesInstanceForTests: (instance: Crownicles | null) => void;
				}>("app");
				distApp.setCrowniclesInstanceForTests(null);
			}
			catch {
				// Best-effort: dist may have been unloaded.
			}
			setBotConfigForTests(null);
			if (previousDbBaseDir === undefined) {
				Reflect.deleteProperty(process.env, CoreConstants.DB_BASE_DIR_ENV_VAR);
			}
			else {
				process.env[CoreConstants.DB_BASE_DIR_ENV_VAR] = previousDbBaseDir;
			}
			activeTestEnvironment = false;
		}
	};
}

// Re-export for convenience so test files can grab the active instance
// without juggling two imports.
export { botConfig, crowniclesInstance };

/**
 * Awaits every promise concurrently. If any rejected, throws the
 * first rejection reason; otherwise returns the fulfilled values in
 * the original order. Used by race tests so the race itself completes
 * before any assertion runs.
 */
export async function runAllOrThrow<T>(promises: Iterable<Promise<T>>): Promise<T[]> {
	const results = await Promise.allSettled(promises);
	const rejected = results.find(r => r.status === "rejected");
	if (rejected) {
		throw (rejected as PromiseRejectedResult).reason;
	}
	return results.map(r => (r as PromiseFulfilledResult<T>).value);
}
