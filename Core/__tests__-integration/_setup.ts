import { createConnection } from "mariadb";
import { Sequelize } from "sequelize";
import { useCLSOnSequelize } from "../../Lib/src/locks/CLSNamespace";

/**
 * Configuration for the MariaDB instance backing the integration tests.
 *
 * Defaults match the dev `Core/config/config.default.toml`, so a fresh
 * checkout that has run `launchScripts/firstConfig.sh` can run the suite
 * without any extra setup. CI overrides these via `TEST_DB_*` env vars.
 */
export interface IntegrationDbConfig {
	host: string;
	port: number;
	rootUser: string;
	rootPassword: string;
	user: string;
	password: string;
}

export function getIntegrationDbConfig(): IntegrationDbConfig {
	return {
		host: process.env.TEST_DB_HOST ?? "127.0.0.1",
		port: Number(process.env.TEST_DB_PORT ?? 3306),
		rootUser: process.env.TEST_DB_ROOT_USER ?? "root",
		rootPassword: process.env.TEST_DB_ROOT_PASSWORD ?? "super_secret_password",
		user: process.env.TEST_DB_USER ?? "draftbot",
		password: process.env.TEST_DB_PASSWORD ?? "secret_password"
	};
}

/**
 * A live test environment: a freshly-created MariaDB schema bound to a
 * Sequelize instance, plus a `teardown()` that drops the schema.
 *
 * The instance is wired into the shared CLS namespace so tests exercise
 * the same transaction-propagation path as production code.
 */
export interface IntegrationTestEnvironment {
	sequelize: Sequelize;
	dbName: string;
	teardown: () => Promise<void>;
}

/**
 * Spin up a one-shot MariaDB schema for an integration test suite.
 *
 * The schema name embeds `pid` and a 32-bit random suffix so two
 * concurrent test runs (e.g. `vitest --watch` + a CI rerun) never share
 * state. `teardown()` is idempotent and safe to call from `afterAll`.
 */
export async function setupIntegrationDb(suiteName: string): Promise<IntegrationTestEnvironment> {
	const config = getIntegrationDbConfig();

	// Sanitize the suite name down to a safe MariaDB identifier fragment.
	const safeSuite = suiteName.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24);
	const dbName = `crownicles_test_${safeSuite}_${process.pid}_${Math.floor(Math.random() * 0xFFFFFFFF).toString(16)}`;

	// Provision the schema with root credentials.
	const adminConn = await createConnection({
		host: config.host,
		port: config.port,
		user: config.rootUser,
		password: config.rootPassword
	});
	try {
		await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;`);

		// The game user can be registered under any host pattern (`%`,
		// `localhost`, the dev host…). Look it up so the GRANT lands on
		// the real account instead of guessing.
		const rows = await adminConn.query(
			"SELECT Host FROM mysql.user WHERE User = ?",
			[config.user]
		) as Array<{ Host: string }>;
		if (rows.length === 0) {
			throw new Error(`Test DB user '${config.user}' does not exist on ${config.host}:${config.port}. Set TEST_DB_USER or create the user first.`);
		}
		for (const { Host } of rows) {
			await adminConn.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${config.user}'@'${Host}';`);
		}
		await adminConn.query("FLUSH PRIVILEGES;");
	}
	finally {
		await adminConn.end();
	}

	// Wire CLS *before* instantiating Sequelize, otherwise the connection
	// captures the namespace-less default and transactions stop propagating.
	// We pass the Sequelize ctor we are about to instantiate from — pnpm
	// can resolve several physical copies of `sequelize` and useCLS only
	// affects the constructor it is called on.
	useCLSOnSequelize(Sequelize);

	const sequelize = new Sequelize(dbName, config.user, config.password, {
		dialect: "mariadb",
		host: config.host,
		port: config.port,
		logging: false
	});

	await sequelize.authenticate();

	return {
		sequelize,
		dbName,
		async teardown() {
			try {
				await sequelize.close();
			}
			catch {
				// Already closed — fine.
			}
			const cleanupConn = await createConnection({
				host: config.host,
				port: config.port,
				user: config.rootUser,
				password: config.rootPassword
			});
			try {
				await cleanupConn.query(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
			}
			finally {
				await cleanupConn.end();
			}
		}
	};
}

/**
 * Resolve when `predicate()` returns true, polling at `intervalMs`. Used by
 * race tests that need to assert "transaction B is still pending" without
 * sleeping for an arbitrary duration.
 */
export async function waitFor(
	predicate: () => boolean,
	{ timeoutMs = 2000, intervalMs = 5 } = {}
): Promise<void> {
	const start = Date.now();
	while (!predicate()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error("waitFor: timeout");
		}
		await new Promise(resolve => setTimeout(resolve, intervalMs));
	}
}
