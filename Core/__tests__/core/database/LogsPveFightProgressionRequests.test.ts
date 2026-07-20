import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { QueryTypes } from "sequelize";
import { LogsPveFightsResults } from "../../../src/core/database/logs/models/LogsPveFightsResults";
import { LogsPveFightProgressionRequests } from "../../../src/core/database/logs/requests/LogsPveFightProgressionRequests";

describe("LogsPveFightProgressionRequests", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("prefers the highest victory from the current class lineage", async () => {
		const query = vi.fn().mockResolvedValue([{ baseLevel: 75 }]);
		Object.defineProperty(LogsPveFightsResults, "sequelize", {
			configurable: true,
			value: { query }
		});

		await expect(LogsPveFightProgressionRequests.getMonsterLevelBase({
			playerKeycloakId: "player-a",
			monsterId: "forestTroll",
			classId: 11
		})).resolves.toBe(75);

		const [sql, options] = query.mock.calls[0];
		expect(sql).toContain("AND action.classId IN (:classIds)");
		expect(sql).toContain("CASE WHEN pve.winner = 1 THEN pve.monsterLevel END DESC");
		expect(sql).toContain("CASE WHEN pve.winner = 1 THEN NULL ELSE pve.date END DESC");
		expect(options).toEqual({
			replacements: {
				playerKeycloakId: "player-a",
				monsterId: "forestTroll",
				classIds: [8, 9, 10, 11, 20],
				failedFightLevelReduction: 10
			},
			type: QueryTypes.SELECT
		});
	});

	it("returns null when the player has no fight in the class lineage", async () => {
		const query = vi.fn().mockResolvedValue([]);
		Object.defineProperty(LogsPveFightsResults, "sequelize", {
			configurable: true,
			value: { query }
		});

		await expect(LogsPveFightProgressionRequests.getMonsterLevelBase({
			playerKeycloakId: "player-a",
			monsterId: "forestTroll",
			classId: 11
		})).resolves.toBeNull();
	});
});