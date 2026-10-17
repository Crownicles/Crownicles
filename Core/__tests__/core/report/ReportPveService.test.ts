import {
	describe, expect, it
} from "vitest";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
import { getPveMonsterLevel } from "../../../src/core/report/ReportPveService";

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