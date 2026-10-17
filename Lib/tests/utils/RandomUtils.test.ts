import {
	describe, expect, it
} from "vitest";
import { RandomUtils } from "../../src/utils/RandomUtils";

describe("RandomUtils.weightedPick", () => {
	it("draws each element proportionally to its weight", () => {
		const weights = new Map([["light", 1], ["heavy", 3]]);
		const draws = 40_000;
		let heavyCount = 0;
		for (let i = 0; i < draws; i++) {
			if (RandomUtils.weightedPick([...weights.keys()], value => weights.get(value)!) === "heavy") {
				heavyCount++;
			}
		}

		expect(heavyCount / draws).toBeCloseTo(0.75, 1);
	});

	it("never draws an element of null weight", () => {
		for (let i = 0; i < 1000; i++) {
			expect(RandomUtils.weightedPick(["never", "always"], value => (value === "never" ? 0 : 1))).toBe("always");
		}
	});
});
