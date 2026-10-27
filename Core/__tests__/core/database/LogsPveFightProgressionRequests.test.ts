import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { QueryTypes } from "sequelize";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import {
	LogsPveFightsResults, PVE_FIGHT_WINNER
} from "../../../src/core/database/logs/models/LogsPveFightsResults";
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
		expect(sql).toContain("AND pve.classId IN (:classIds)");
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

	it("returns null when the logs database is unavailable", async () => {
		const error = new Error("logs unavailable");
		const query = vi.fn().mockRejectedValue(error);
		const logError = vi.spyOn(CrowniclesLogger, "errorWithObj").mockImplementation(() => undefined);
		Object.defineProperty(LogsPveFightsResults, "sequelize", {
			configurable: true,
			value: { query }
		});

		await expect(LogsPveFightProgressionRequests.getMonsterLevelBase({
			playerKeycloakId: "player-a",
			monsterId: "forestTroll",
			classId: 11
		})).resolves.toBeNull();
		expect(logError).toHaveBeenCalledWith(
			"Failed to retrieve PVE fight progression, using player level",
			error
		);
	});

	describe("getBossLadder", () => {
		const params = {
			playerKeycloakId: "player-a",
			monsterId: "yukiOnna"
		};

		it("gets the strongest boss killed and the last fight against it, whatever the class", async () => {
			const query = vi.fn((sql: string) => Promise.resolve(sql.includes("MAX(fights.monsterLevel)")
				? [{ level: 58 }]
				: [{
					level: 63, winner: PVE_FIGHT_WINNER.MONSTER, playerLevel: 71
				}]));
			Object.defineProperty(LogsPveFightsResults, "sequelize", {
				configurable: true,
				value: { query }
			});

			await expect(LogsPveFightProgressionRequests.getBossLadder(params)).resolves.toEqual({
				strongestVictoryLevel: 58,
				lastFight: {
					level: 63, isDefeat: true, playerLevel: 71
				}
			});
			for (const [sql] of query.mock.calls) {
				expect(sql).not.toContain("classId");
				expect(sql).toContain("fights.monsterId = :monsterId");
			}
		});

		it("is empty when the player never fought the boss", async () => {
			Object.defineProperty(LogsPveFightsResults, "sequelize", {
				configurable: true,
				value: { query: vi.fn((sql: string) => Promise.resolve(sql.includes("MAX(") ? [{ level: null }] : [])) }
			});

			await expect(LogsPveFightProgressionRequests.getBossLadder(params)).resolves.toEqual({
				strongestVictoryLevel: null, lastFight: null
			});
		});

		it("is empty when the logs database is unavailable", async () => {
			const error = new Error("logs unavailable");
			const logError = vi.spyOn(CrowniclesLogger, "errorWithObj").mockImplementation(() => undefined);
			Object.defineProperty(LogsPveFightsResults, "sequelize", {
				configurable: true,
				value: { query: vi.fn().mockRejectedValue(error) }
			});

			await expect(LogsPveFightProgressionRequests.getBossLadder(params)).resolves.toEqual({
				strongestVictoryLevel: null, lastFight: null
			});
			expect(logError).toHaveBeenCalledWith("Failed to retrieve the PVE boss ladder, drawing the opponent around the player level", error);
		});
	});
});
