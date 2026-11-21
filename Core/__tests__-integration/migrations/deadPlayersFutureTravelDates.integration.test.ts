import {
	afterAll, beforeAll, describe, expect, it
} from "vitest";
import type {
	ModelStatic, QueryInterface
} from "sequelize";
import {
	CoreTestEnvironment, loadProductionModule, setupCoreForTests
} from "../_coreSetup";
import type { Player as PlayerType } from "../../src/core/database/game/models/Player";
import { Effect } from "../../../Lib/src/types/Effect";
import { minutesToMilliseconds } from "../../../Lib/src/utils/TimeUtils";

type MigrationModule = typeof import("../../src/core/database/game/migrations/083-dead-players-future-travel-dates");

describe("migration 083: dead players are no longer active until 2053 (#5140)", () => {
	let env: CoreTestEnvironment;
	let Player: ModelStatic<PlayerType>;
	let migration: MigrationModule;

	beforeAll(async () => {
		env = await setupCoreForTests("deadplayersdates");
		Player = env.crownicles.gameDatabase.sequelize.models.Player as ModelStatic<PlayerType>;
		migration = loadProductionModule<MigrationModule>("core/database/game/migrations/083-dead-players-future-travel-dates");
	});

	afterAll(async () => {
		await env?.teardown();
	});

	function createDeadPlayer(keycloakId: string, deathDate: Date, travelAndActivityDate: Date): Promise<PlayerType> {
		return Player.create({
			keycloakId,
			effectId: Effect.DEAD.id,
			effectDuration: Effect.DEAD.timeMinutes,
			effectEndDate: new Date(deathDate.valueOf() + minutesToMilliseconds(Effect.DEAD.timeMinutes)),
			startTravelDate: travelAndActivityDate,
			lastActivityAt: travelAndActivityDate
		});
	}

	it("puts the travel and activity dates of the players who died in 2021-2022 back at their date of death", async () => {
		const legacyDeathDate = new Date("2022-03-01T12:00:00.000Z");
		const legacyDead = await createDeadPlayer(
			"legacy-dead",
			legacyDeathDate,

			// Like in production: a few seconds before the end of the death effect, in 2053
			new Date(legacyDeathDate.valueOf() + minutesToMilliseconds(Effect.DEAD.timeMinutes) - 5_000)
		);
		const recentDeathDate = new Date("2025-06-01T12:00:00.000Z");
		const recentTravelStart = new Date("2025-05-31T08:00:00.000Z");
		const recentDead = await createDeadPlayer("recent-dead", recentDeathDate, recentTravelStart);

		await migration.up({ context: env.crownicles.gameDatabase.sequelize.getQueryInterface() as QueryInterface });

		await legacyDead.reload();
		expect(legacyDead.startTravelDate).toEqual(legacyDeathDate);
		expect(legacyDead.lastActivityAt).toEqual(legacyDeathDate);
		await recentDead.reload();
		expect(recentDead.startTravelDate).toEqual(recentTravelStart);
		expect(recentDead.lastActivityAt).toEqual(recentTravelStart);
	});
});
