import {
	describe, expect, it
} from "vitest";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
import { getPveMonsterLevel } from "../../../src/core/report/ReportPveService";

describe("getPveMonsterLevel", () => {
	it("generates levels from ten below through five above the base", () => {
		const baseLevel = 100;

		expect(getPveMonsterLevel(baseLevel, 0)).toBe(90);
		expect(getPveMonsterLevel(baseLevel, PVEConstants.MONSTER_LEVEL_RANDOM_RANGE - 1)).toBe(105);
	});

	it("never generates a level below the minimum monster level", () => {
		expect(getPveMonsterLevel(0, 0)).toBe(PVEConstants.MIN_MONSTER_LEVEL);
	});
});