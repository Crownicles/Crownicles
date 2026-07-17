import {
	describe, expect, it
} from "vitest";
import { PveBossFightRecord } from "../../../../Lib/src/types/PveBossRecord";
import {
	selectPersonalBossRecords
} from "../../../src/core/database/logs/requests/LogsPveBossRecordsUtils";

const record = (overrides: Partial<PveBossFightRecord>): PveBossFightRecord => ({
	playerKeycloakId: "player-a",
	monsterId: "magmaTitan",
	monsterLevel: 100,
	classId: 4,
	turns: 12,
	date: 1_000,
	actions: [],
	...overrides
});

describe("LogsPveBossRecordsUtils", () => {
	it("keeps the highest-level personal victory for each boss", () => {
		const records = selectPersonalBossRecords([
			record({ monsterLevel: 100 }),
			record({ monsterLevel: 105, turns: 20 }),
			record({ monsterId: "kraken", monsterLevel: 90 })
		]);

		expect(records).toEqual([
			expect.objectContaining({ monsterId: "magmaTitan", monsterLevel: 105 }),
			expect.objectContaining({ monsterId: "kraken", monsterLevel: 90 })
		]);
	});

	it("breaks equal levels by fewer turns then oldest victory", () => {
		const records = selectPersonalBossRecords([
			record({ turns: 12, date: 900 }),
			record({ turns: 10, date: 1_100 }),
			record({ turns: 10, date: 1_000 })
		]);

		expect(records[0]).toEqual(expect.objectContaining({ turns: 10, date: 1_000 }));
	});

});