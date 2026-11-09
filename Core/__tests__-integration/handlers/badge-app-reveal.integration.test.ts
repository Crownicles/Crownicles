import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import { QueryInterface } from "sequelize";
import {
	IntegrationTestEnvironment, setupIntegrationDb
} from "../_setup";
import {
	initModel as initPlayerBadges, PlayerBadges, PlayerBadgesManager
} from "../../src/core/database/game/models/PlayerBadges";
import { up as addBadgeAppReveal } from "../../src/core/database/game/migrations/085-badge-app-reveal";
import { Badge } from "../../../Lib/src/types/Badge";

const PLAYER_ID = 7;
const OTHER_PLAYER_ID = 8;

let env: IntegrationTestEnvironment;

beforeAll(async () => {
	env = await setupIntegrationDb("badge_app_reveal");
	initPlayerBadges(env.sequelize);
	await env.sequelize.sync();

	// Umzug creates its table before running any migration: the migration looks there for its former name
	await env.sequelize.query("CREATE TABLE SequelizeMeta (name VARCHAR(255) PRIMARY KEY)");
}, 60_000);

afterAll(async () => {
	if (env) {
		await env.teardown();
	}
}, 60_000);

beforeEach(async () => {
	await PlayerBadges.destroy({ where: {}, truncate: true });
});

describe("badges celebrated by the app", () => {
	it("lists a new badge until a device celebrates it, then on no other device", async () => {
		await PlayerBadgesManager.addBadge(PLAYER_ID, Badge.TOP_WEEK);
		await PlayerBadgesManager.addBadge(PLAYER_ID, Badge.RICH);
		await PlayerBadgesManager.addBadge(OTHER_PLAYER_ID, Badge.TOP_WEEK);

		await expect(PlayerBadgesManager.getUnrevealedInApp(PLAYER_ID)).resolves.toEqual(expect.arrayContaining([Badge.TOP_WEEK, Badge.RICH]));

		await PlayerBadgesManager.markRevealedInApp(PLAYER_ID, [Badge.TOP_WEEK]);

		await expect(PlayerBadgesManager.getUnrevealedInApp(PLAYER_ID)).resolves.toEqual([Badge.RICH]);
		await expect(PlayerBadgesManager.getUnrevealedInApp(OTHER_PLAYER_ID)).resolves.toEqual([Badge.TOP_WEEK]);
	});

	it("keeps a celebrated badge celebrated when an admin rewrites the badge list", async () => {
		await PlayerBadgesManager.addBadge(PLAYER_ID, Badge.TOP_WEEK);
		await PlayerBadgesManager.markRevealedInApp(PLAYER_ID, [Badge.TOP_WEEK]);

		await PlayerBadgesManager.setBadges(PLAYER_ID, [Badge.TOP_WEEK, Badge.RICH]);

		await expect(PlayerBadgesManager.getOfPlayer(PLAYER_ID)).resolves.toEqual(expect.arrayContaining([Badge.TOP_WEEK, Badge.RICH]));
		await expect(PlayerBadgesManager.getUnrevealedInApp(PLAYER_ID)).resolves.toEqual([Badge.RICH]);

		await PlayerBadgesManager.setBadges(PLAYER_ID, []);
		await expect(PlayerBadgesManager.getOfPlayer(PLAYER_ID)).resolves.toEqual([]);
	});

	it("does not announce the badges owned before the migration", async () => {
		const queryInterface = env.sequelize.getQueryInterface() as QueryInterface;
		await queryInterface.dropTable("player_badges");
		await queryInterface.createTable("player_badges", {
			playerId: {
				type: "INTEGER", primaryKey: true
			},
			badge: {
				type: "VARCHAR(32)", primaryKey: true
			},
			updatedAt: { type: "DATETIME" },
			createdAt: { type: "DATETIME" }
		});
		await env.sequelize.query(`INSERT INTO player_badges (playerId, badge, updatedAt, createdAt) VALUES (${PLAYER_ID}, '${Badge.RICH}', NOW(), NOW())`);

		await addBadgeAppReveal({ context: queryInterface });
		await PlayerBadgesManager.addBadge(PLAYER_ID, Badge.TOP_WEEK);

		await expect(PlayerBadgesManager.getUnrevealedInApp(PLAYER_ID)).resolves.toEqual([Badge.TOP_WEEK]);
	});
});
