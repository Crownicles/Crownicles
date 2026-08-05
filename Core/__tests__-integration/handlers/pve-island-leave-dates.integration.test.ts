import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import {
	IntegrationTestEnvironment, setupIntegrationDb
} from "../_setup";
import {
	initModel as initLogsPlayers, LogsPlayers
} from "../../src/core/database/logs/models/LogsPlayers";
import {
	initModel as initLogsPlayersTravels, LogsPlayersTravels
} from "../../src/core/database/logs/models/LogsPlayersTravels";
import { getPveIslandLeaveDates } from "../../src/core/database/logs/requests/LogsPveIslandRequests";
import { MapCache } from "../../src/core/maps/MapCache";

const ISLAND_LINK = 100;

const CONTINENT_LINK = 200;

const HOUR = 3_600;

let env: IntegrationTestEnvironment;

async function travel(playerId: number, mapLinkId: number, date: number): Promise<void> {
	await LogsPlayersTravels.create({
		playerId,
		mapLinkId,
		date
	});
}

beforeAll(async () => {
	env = await setupIntegrationDb("pve_island_leave_dates");
	initLogsPlayers(env.sequelize);
	initLogsPlayersTravels(env.sequelize);
	await env.sequelize.sync();
	MapCache.logsPveIslandMapLinks = [ISLAND_LINK];
}, 60_000);

afterAll(async () => {
	if (env) {
		await env.teardown();
	}
}, 60_000);

beforeEach(async () => {
	await LogsPlayersTravels.destroy({
		where: {},
		truncate: true
	});
	await LogsPlayers.destroy({
		where: {},
		truncate: true
	});
});

describe("PvE island leave dates", () => {
	it("reports the first travel outside the island even when the last island travel is old", async () => {
		const player = await LogsPlayers.create({ keycloakId: "fainted-ally" });
		await travel(player.id, ISLAND_LINK, 1_000);
		await travel(player.id, CONTINENT_LINK, 1_000 + 3 * HOUR);

		await expect(getPveIslandLeaveDates([player.id])).resolves.toEqual([
			{
				playerId: player.id,
				leaveDate: 1_000 + 3 * HOUR
			}
		]);
	});

	it("ignores travels made on the continent before the player reached the island", async () => {
		const player = await LogsPlayers.create({ keycloakId: "arriving-ally" });
		await travel(player.id, CONTINENT_LINK, 500);
		await travel(player.id, ISLAND_LINK, 1_000);
		await travel(player.id, CONTINENT_LINK, 2_000);

		await expect(getPveIslandLeaveDates([player.id])).resolves.toEqual([
			{
				playerId: player.id,
				leaveDate: 2_000
			}
		]);
	});

	it("reports no leave date for a player still on the island", async () => {
		const player = await LogsPlayers.create({ keycloakId: "still-on-island" });
		await travel(player.id, CONTINENT_LINK, 500);
		await travel(player.id, ISLAND_LINK, 1_000);

		await expect(getPveIslandLeaveDates([player.id])).resolves.toEqual([]);
	});

	it("reports no leave date for a player that came back to the island", async () => {
		const player = await LogsPlayers.create({ keycloakId: "returning-ally" });
		await travel(player.id, ISLAND_LINK, 1_000);
		await travel(player.id, CONTINENT_LINK, 2_000);
		await travel(player.id, ISLAND_LINK, 3_000);

		await expect(getPveIslandLeaveDates([player.id])).resolves.toEqual([]);
	});

	it("reports no leave date for a player that never went to the island", async () => {
		const player = await LogsPlayers.create({ keycloakId: "landlubber" });
		await travel(player.id, CONTINENT_LINK, 1_000);

		await expect(getPveIslandLeaveDates([player.id])).resolves.toEqual([]);
	});

	it("keeps one leave date per player", async () => {
		const firstPlayer = await LogsPlayers.create({ keycloakId: "first-ally" });
		const secondPlayer = await LogsPlayers.create({ keycloakId: "second-ally" });
		await travel(firstPlayer.id, ISLAND_LINK, 1_000);
		await travel(firstPlayer.id, CONTINENT_LINK, 2_000);
		await travel(firstPlayer.id, CONTINENT_LINK, 3_000);
		await travel(secondPlayer.id, ISLAND_LINK, 1_500);
		await travel(secondPlayer.id, CONTINENT_LINK, 4_000);

		const leaveDates = await getPveIslandLeaveDates([firstPlayer.id, secondPlayer.id]);

		expect(leaveDates).toEqual(expect.arrayContaining([
			{
				playerId: firstPlayer.id,
				leaveDate: 2_000
			},
			{
				playerId: secondPlayer.id,
				leaveDate: 4_000
			}
		]));
		expect(leaveDates).toHaveLength(2);
	});
});
