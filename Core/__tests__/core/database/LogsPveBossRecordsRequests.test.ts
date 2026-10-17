import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { LogsPveBossRecordsRequests } from "../../../src/core/database/logs/requests/LogsPveBossRecordsRequests";
import { LogsPveFightsResults } from "../../../src/core/database/logs/models/LogsPveFightsResults";
import { QueryTypes } from "sequelize";

describe("LogsPveBossRecordsRequests", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("rejects a leaderboard request for a class below the maximum tier", async () => {
		vi.spyOn(LogsPveBossRecordsRequests, "getMaximumTierClassIds").mockReturnValue([18, 19, 20]);
		const query = vi.fn();
		Object.defineProperty(LogsPveFightsResults, "sequelize", {
			configurable: true,
			value: { query }
		});

		await expect(LogsPveBossRecordsRequests.getLeaderboard("magmaTitan", 3)).resolves.toEqual([]);
		expect(query).not.toHaveBeenCalled();
	});

	it("rejects a leaderboard request for a non-final monster", async () => {
		vi.spyOn(LogsPveBossRecordsRequests, "getMaximumTierClassIds").mockReturnValue([18]);
		const query = vi.fn();
		Object.defineProperty(LogsPveFightsResults, "sequelize", {
			configurable: true,
			value: { query }
		});

		await expect(LogsPveBossRecordsRequests.getLeaderboard("forestTroll", 18)).resolves.toEqual([]);
		expect(query).not.toHaveBeenCalled();
	});

	it("queries the top ten records with deterministic per-player ranking", async () => {
		vi.spyOn(LogsPveBossRecordsRequests, "getMaximumTierClassIds").mockReturnValue([18]);
		const expectedEntries = [{
			playerKeycloakId: "player-a",
			monsterId: "magmaTitan",
			monsterLevel: 120,
			classId: 18,
			turns: 9,
			date: 1_000
		}];
		const query = vi.fn().mockResolvedValue(expectedEntries);
		Object.defineProperty(LogsPveFightsResults, "sequelize", {
			configurable: true,
			value: { query }
		});

		await expect(LogsPveBossRecordsRequests.getLeaderboard("magmaTitan", 18)).resolves.toEqual(expectedEntries);
		expect(query).toHaveBeenCalledOnce();
		const [sql, options] = query.mock.calls[0];
		expect(sql).toContain("PARTITION BY player.keycloakId");
		expect(sql).toContain("ORDER BY pve.monsterLevel DESC, pve.turn ASC, pve.date ASC, pve.id ASC");
		expect(sql).toContain("AND action.classId = :classId");
		expect(sql).toContain("LIMIT :limit");
		expect(options).toEqual({
			replacements: {
				monsterId: "magmaTitan", classId: 18, limit: 10
			},
			type: QueryTypes.SELECT
		});
	});
});