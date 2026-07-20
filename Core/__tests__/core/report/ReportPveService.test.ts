import {
	describe, expect, it
} from "vitest";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
import { getPveMonsterLevel } from "../../../src/core/report/ReportPveService";

describe("getPveMonsterLevel", () => {
	it("generates non-final boss levels from twenty below through three above the base", () => {
		const baseLevel = 100;

		expect(getPveMonsterLevel(baseLevel, 0, false)).toBe(80);
		expect(getPveMonsterLevel(baseLevel, PVEConstants.NON_FINAL_BOSS_MONSTER_LEVEL_RANDOM_RANGE - 1, false)).toBe(103);
	});

	it("keeps final boss levels from ten below through five above the base", () => {
		const baseLevel = 100;

		expect(getPveMonsterLevel(baseLevel, 0, true)).toBe(90);
		expect(getPveMonsterLevel(baseLevel, PVEConstants.FINAL_BOSS_MONSTER_LEVEL_RANDOM_RANGE - 1, true)).toBe(105);
	});

	it("never generates a level below the minimum monster level", () => {
		expect(getPveMonsterLevel(0, 0, false)).toBe(PVEConstants.MIN_MONSTER_LEVEL);
	});
});