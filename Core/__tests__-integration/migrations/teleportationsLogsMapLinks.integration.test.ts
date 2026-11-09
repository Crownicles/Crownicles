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
import { MapLinkDataController } from "../../src/data/MapLink";
import type { LogsDatabase as LogsDatabaseType } from "../../src/core/database/logs/LogsDatabase";

type BootstrapModule = typeof import("../../src/bootstrap");
type LogsDatabaseModule = typeof import("../../src/core/database/logs/LogsDatabase");

const LAST_MIGRATION_BEFORE_TELEPORTATIONS_LOGS_MAP_LINKS = "038-blacksmith-enchantment-transfer-logging.js";

const UNKNOWN_GAME_MAP_LINK_ID = 99999;

const PLACEHOLDER_LOGS_MAP_LINK = {
	start: 60000, end: 60001
};

type TeleportationWithMapLinks = {
	playerId: number;
	originMapLinkId: number;
	newMapLinkId: number;
	originStart: number;
	originEnd: number;
	newStart: number;
	newEnd: number;
};

describe("Logs migration 039: teleportations use the logs map link ids", () => {
	let env: CoreTestEnvironment;
	let distBootstrap: BootstrapModule;
	let logsDatabase: LogsDatabaseType;

	beforeAll(async () => {
		env = await setupCoreForTests("teleportationlogs");

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

	it("converts the game ids in one pass even when they overlap with the logs ids, and deletes the unknown ones", async () => {
		const gameMapLink1 = MapLinkDataController.instance.getById(1)!;
		const gameMapLink2 = MapLinkDataController.instance.getById(2)!;
		const gameMapLink3 = MapLinkDataController.instance.getById(3)!;

		await logsDatabase.umzug.up({ to: LAST_MIGRATION_BEFORE_TELEPORTATIONS_LOGS_MAP_LINKS });

		await logsDatabase.sequelize.query(
			"INSERT INTO map_links (id, `start`, `end`) VALUES (1, :placeholderStart, :placeholderEnd), (2, :start1, :end1), (3, :start2, :end2)",
			{
				replacements: {
					placeholderStart: PLACEHOLDER_LOGS_MAP_LINK.start,
					placeholderEnd: PLACEHOLDER_LOGS_MAP_LINK.end,
					start1: gameMapLink1.startMap,
					end1: gameMapLink1.endMap,
					start2: gameMapLink2.startMap,
					end2: gameMapLink2.endMap
				}
			}
		);
		await logsDatabase.sequelize.query(
			`INSERT INTO players_teleportations (playerId, originMapLinkId, newMapLinkId, date) VALUES
				(1, 1, 2, 100),
				(2, 2, 1, 100),
				(3, 3, 1, 100),
				(4, 1, ${UNKNOWN_GAME_MAP_LINK_ID}, 100),
				(5, ${UNKNOWN_GAME_MAP_LINK_ID}, 2, 100)`
		);

		await logsDatabase.umzug.up();

		await expect(logsDatabase.umzug.pending()).resolves.toEqual([]);
		const teleportations = await logsDatabase.sequelize.query<TeleportationWithMapLinks>(
			`SELECT teleportation.playerId, teleportation.originMapLinkId, teleportation.newMapLinkId,
				origin.\`start\` AS originStart, origin.\`end\` AS originEnd,
				destination.\`start\` AS newStart, destination.\`end\` AS newEnd
			FROM players_teleportations teleportation
			INNER JOIN map_links origin ON origin.id = teleportation.originMapLinkId
			INNER JOIN map_links destination ON destination.id = teleportation.newMapLinkId
			ORDER BY teleportation.playerId`,
			{ type: QueryTypes.SELECT }
		);

		expect(teleportations.map(teleportation => teleportation.playerId)).toEqual([1, 2, 3]);

		expect(teleportations[0]).toMatchObject({
			originMapLinkId: 2,
			newMapLinkId: 3
		});
		expect(teleportations[1]).toMatchObject({
			originMapLinkId: 3,
			newMapLinkId: 2
		});

		expect(teleportations[2]).toMatchObject({
			originStart: gameMapLink3.startMap,
			originEnd: gameMapLink3.endMap,
			newStart: gameMapLink1.startMap,
			newEnd: gameMapLink1.endMap,
			newMapLinkId: 2
		});

		const [{ count }] = await logsDatabase.sequelize.query<{ count: number | bigint }>(
			"SELECT COUNT(*) AS count FROM map_links",
			{ type: QueryTypes.SELECT }
		);
		expect(Number(count)).toBe(4);
	});
});
