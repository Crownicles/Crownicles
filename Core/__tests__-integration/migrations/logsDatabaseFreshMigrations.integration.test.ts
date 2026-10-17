import {
	afterAll, beforeAll, describe, expect, it
} from "vitest";
import { createConnection } from "mariadb";
import { QueryTypes } from "sequelize";
import { getIntegrationDbConfig } from "../_setup";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import { botConfig } from "../../src/bootstrap";
import type { LogsDatabase as LogsDatabaseType } from "../../src/core/database/logs/LogsDatabase";

type BootstrapModule = typeof import("../../src/bootstrap");
type LogsDatabaseModule = typeof import("../../src/core/database/logs/LogsDatabase");

const LAST_MIGRATION_BEFORE_POSSIBILITIES_V5 = "009-improve-log-fight.js";

/**
 * Regression test for issue #4869: deploying from scratch runs every logs migration on an empty schema,
 * which no other suite does since they stub the logs database.
 */
describe("Logs database migrations on a fresh schema (issue #4869)", () => {
	let env: CoreTestEnvironment;
	let distBootstrap: BootstrapModule;
	let logsDatabase: LogsDatabaseType;

	beforeAll(async () => {
		// Some logs migrations read the game database, which production also initialises first
		env = await setupCoreForTests("logsmigrations");

		// The logs database reads its migrations next to its compiled file, so it must come from dist
		distBootstrap = loadProductionModule<BootstrapModule>("bootstrap");
		distBootstrap.setBotConfigForTests(botConfig);
		const { LogsDatabase } = loadProductionModule<LogsDatabaseModule>("core/database/logs/LogsDatabase");
		logsDatabase = new LogsDatabase();
		await logsDatabase.init(false);
	});

	afterAll(async () => {
		await logsDatabase?.sequelize?.close();
		distBootstrap?.setBotConfigForTests(null);
		const dbConfig = getIntegrationDbConfig();
		const adminConn = await createConnection({
			host: dbConfig.host,
			port: dbConfig.port,
			user: dbConfig.rootUser,
			password: dbConfig.rootPassword
		});
		try {
			await adminConn.query(`DROP DATABASE IF EXISTS \`${env.prefix}_logs\`;`);
		}
		finally {
			await adminConn.end();
		}
		await env?.teardown();
	});

	it("applies every migration and renames the v4 possibility emojis", async () => {
		await logsDatabase.umzug.up({ to: LAST_MIGRATION_BEFORE_POSSIBILITIES_V5 });
		await logsDatabase.sequelize.query(
			"INSERT INTO possibilities (bigEventId, possibilityName, issueIndex) VALUES (1, '🪓', 0), (10, '🎣', 0)"
		);

		await logsDatabase.umzug.up();

		await expect(logsDatabase.umzug.pending()).resolves.toEqual([]);
		const possibilities = await logsDatabase.sequelize.query<{
			bigEventId: number;
			possibilityName: string;
		}>("SELECT bigEventId, possibilityName FROM possibilities ORDER BY bigEventId", { type: QueryTypes.SELECT });
		expect(possibilities).toEqual([
			{
				bigEventId: 1, possibilityName: "cutTree"
			},
			{
				bigEventId: 10, possibilityName: "help"
			}
		]);
	});
});
