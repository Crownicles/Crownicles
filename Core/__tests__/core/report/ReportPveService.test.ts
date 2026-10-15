import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
import {
	finalBossNewRecord, getPveMonsterLevel
} from "../../../src/core/report/ReportPveService";
import { LogsPveBossRecordsRequests } from "../../../src/core/database/logs/requests/LogsPveBossRecordsRequests";
import { Player } from "../../../src/core/database/game/models/Player";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

const PLAYER = {
	keycloakId: "record-holder", class: 18
} as Player;

describe("finalBossNewRecord", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("sets a record above the best level this class ever beat the boss at", async () => {
		const bestWin = vi.spyOn(LogsPveBossRecordsRequests, "getBestWinLevel").mockResolvedValue(130);

		await expect(finalBossNewRecord(PLAYER, {
			id: "magmaTitan", level: 142
		})).resolves.toStrictEqual({
			monsterId: "magmaTitan", monsterLevel: 142, classId: 18, previousLevel: 130
		});
		expect(bestWin).toHaveBeenCalledWith({
			playerKeycloakId: "record-holder", monsterId: "magmaTitan", classId: 18
		});
	});

	it("sets a first record when the class never beat the boss", async () => {
		vi.spyOn(LogsPveBossRecordsRequests, "getBestWinLevel").mockResolvedValue(null);

		await expect(finalBossNewRecord(PLAYER, {
			id: "kraken", level: 60
		})).resolves.toStrictEqual({
			monsterId: "kraken", monsterLevel: 60, classId: 18
		});
	});

	it("sets no record at or below the best level already beaten", async () => {
		vi.spyOn(LogsPveBossRecordsRequests, "getBestWinLevel").mockResolvedValue(142);

		await expect(finalBossNewRecord(PLAYER, {
			id: "magmaTitan", level: 142
		})).resolves.toBeNull();
		await expect(finalBossNewRecord(PLAYER, {
			id: "magmaTitan", level: 120
		})).resolves.toBeNull();
	});

	it("ignores bosses that do not close an island", async () => {
		const bestWin = vi.spyOn(LogsPveBossRecordsRequests, "getBestWinLevel");

		await expect(finalBossNewRecord(PLAYER, {
			id: "forestTroll", level: 500
		})).resolves.toBeNull();
		expect(bestWin).not.toHaveBeenCalled();
	});

	it("sets no record when the past wins cannot be read", async () => {
		vi.spyOn(LogsPveBossRecordsRequests, "getBestWinLevel").mockRejectedValue(new Error("logs database down"));
		const logged = vi.spyOn(CrowniclesLogger, "errorWithObj").mockImplementation(() => undefined);

		await expect(finalBossNewRecord(PLAYER, {
			id: "magmaTitan", level: 142
		})).resolves.toBeNull();
		expect(logged).toHaveBeenCalledOnce();
	});
});

describe("getPveMonsterLevel", () => {
	it("generates non-final boss levels above the record 12% of the time", () => {
		const baseLevel = 100;

		expect(getPveMonsterLevel(baseLevel, 11, false)).toBeGreaterThan(baseLevel);
		expect(getPveMonsterLevel(baseLevel, 12, false)).toBeLessThan(baseLevel);
	});

	it("generates final boss levels above the record 18% of the time", () => {
		const baseLevel = 100;

		expect(getPveMonsterLevel(baseLevel, 17, true)).toBeGreaterThan(baseLevel);
		expect(getPveMonsterLevel(baseLevel, 18, true)).toBeLessThan(baseLevel);
	});

	it("uses the requested level ranges for each boss type", () => {
		const baseLevel = 100;

		expect(getPveMonsterLevel(baseLevel, 12, false)).toBe(80);
		expect(getPveMonsterLevel(baseLevel, 400, false)).toBe(105);
		expect(getPveMonsterLevel(baseLevel, 18, true)).toBe(90);
		expect(getPveMonsterLevel(baseLevel, 400, true)).toBe(105);
	});

	it("never generates a level below the minimum monster level", () => {
		expect(getPveMonsterLevel(0, 0, false)).toBe(PVEConstants.MIN_MONSTER_LEVEL);
	});
});