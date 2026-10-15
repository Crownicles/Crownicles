import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryTypes } from "sequelize";
import { AdventureHistoryConstants } from "../../../../Lib/src/constants/AdventureHistoryConstants";
import { asSeconds } from "../../../../Lib/src/utils/TimeUtils";
import { LogsPlayers } from "../../../src/core/database/logs/models/LogsPlayers";
import { LogsPlayersPossibilities } from "../../../src/core/database/logs/models/LogsPlayersPossibilities";
import { getAdventureHistory } from "../../../src/core/database/logs/requests/LogsAdventureHistoryRequests";

const LOG_PLAYER_ID = 42;

function mockLogs(rows: object[], player: { id: number } | null = { id: LOG_PLAYER_ID }): { query: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.spyOn> } {
	const query = vi.fn().mockResolvedValue(rows);
	Object.defineProperty(LogsPlayersPossibilities, "sequelize", { configurable: true, value: { query } });
	const findOne = vi.spyOn(LogsPlayers, "findOne").mockResolvedValue(player as LogsPlayers | null);
	return { query, findOne };
}

describe("adventure history log reader", () => {
	afterEach((): void => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("reads only the authenticated player's seven-day window through the indexed player id", async () => {
		vi.useFakeTimers({ now: new Date("2026-10-07T12:00:00Z") });
		const { query, findOne } = mockLogs([]);

		const result = await getAdventureHistory("player-a");

		expect(findOne).toHaveBeenCalledWith({ attributes: ["id"], where: { keycloakId: "player-a" } });
		const [sql, options] = query.mock.calls[0];
		expect(sql).toContain("entry.playerId = :playerId AND entry.date >= :since AND entry.date <= :until");
		expect(sql).not.toMatch(/INSERT|UPDATE|DELETE/i);
		expect(options).toEqual({
			replacements: {
				playerId: LOG_PLAYER_ID,
				expiredPossibility: "end",
				since: result.until + 1 - AdventureHistoryConstants.WINDOW_SECONDS,
				until: result.until,
				limit: AdventureHistoryConstants.PAGE_SIZE + 1,
				offset: 0
			},
			type: QueryTypes.SELECT
		});
		expect(result.entries).toEqual([]);
		expect(result).not.toHaveProperty("nextPage");
	});

	it("answers an empty history without creating a log player for an account that has none", async () => {
		const create = vi.spyOn(LogsPlayers, "findOrCreate");
		const { query } = mockLogs([], null);

		const result = await getAdventureHistory("unknown");

		expect(result.entries).toEqual([]);
		expect(query).not.toHaveBeenCalled();
		expect(create).not.toHaveBeenCalled();
	});

	it("keeps the same time fence while paging and does not return the extra probe row", async () => {
		vi.useFakeTimers({ now: 2_000_000 });
		const { query } = mockLogs(Array.from({ length: AdventureHistoryConstants.PAGE_SIZE + 1 }, (_unused, index) => ({
			date: asSeconds(1_000 - index), eventId: 60, possibilityId: "start", outcomeId: "0", mapId: null
		})));

		const result = await getAdventureHistory("player-a", 1, asSeconds(1_000));

		expect(result.entries).toHaveLength(AdventureHistoryConstants.PAGE_SIZE);
		expect(result.until).toBe(1_000);
		expect(result.nextPage).toBe(2);
		expect(query.mock.calls[0][1].replacements.offset).toBe(AdventureHistoryConstants.PAGE_SIZE);
	});

	it("does not let a client timestamp move the seven-day window into the past", async () => {
		vi.useFakeTimers({ now: 2_000_000 });
		const { query } = mockLogs([]);

		await getAdventureHistory("player-a", 0, asSeconds(1_000));

		expect(query.mock.calls[0][1].replacements.since).toBe(2_000 - AdventureHistoryConstants.WINDOW_SECONDS);
	});

	it("places an event at the end of the last travel the same player started before it", async () => {
		vi.useFakeTimers({ now: 2_000_000 });
		const { query } = mockLogs([
			{ date: asSeconds(1_500), eventId: 3, possibilityId: "fight", outcomeId: "1", mapId: 12 },
			{ date: asSeconds(1_400), eventId: 4, possibilityId: "end", outcomeId: "0", mapId: null }
		]);

		const result = await getAdventureHistory("player-a");

		const sql: string = query.mock.calls[0][0];
		expect(sql).toContain("travel.playerId = entry.playerId AND travel.date < entry.date");
		expect(sql).toContain("ORDER BY travel.date DESC LIMIT 1");
		expect(result.entries[0].mapId).toBe(12);
		expect(result.entries[1]).not.toHaveProperty("mapId");
	});

	it.each([-1, 0.5, AdventureHistoryConstants.MAX_PAGE + 1])("rejects an invalid page %s before querying", async page => {
		const { query, findOne } = mockLogs([]);

		await expect(getAdventureHistory("player-a", page)).rejects.toThrow(RangeError);
		expect(query).not.toHaveBeenCalled();
		expect(findOne).not.toHaveBeenCalled();
	});
});
