import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { RandomUtils } from "../../src/utils/RandomUtils";
import { DayOfTheWeek } from "../../src/constants/TimeConstants";

const DRAWS = 2000;

function drawMany(draw: () => number): Set<number> {
	const results = new Set<number>();
	for (let i = 0; i < DRAWS; i++) {
		results.add(draw());
	}
	return results;
}

function sorted(values: Set<number>): number[] {
	return [...values].sort((a, b) => a - b);
}

describe("RandomUtils integer draws", () => {
	it("randInt excludes the upper bound", () => {
		expect(sorted(drawMany(() => RandomUtils.randInt(3, 6)))).toEqual([3, 4, 5]);
	});

	it("rangedInt includes both bounds of the range", () => {
		expect(sorted(drawMany(() => RandomUtils.rangedInt({
			MIN: 1, MAX: 3
		})))).toEqual([1, 2, 3]);
	});

	it("rangedInt shifts each bound by its own offset", () => {
		expect(sorted(drawMany(() => RandomUtils.rangedInt({
			MIN: 1, MAX: 3
		}, 2, 4)))).toEqual([3, 4, 5, 6, 7]);
	});

	it("variationInt draws in the symmetric interval", () => {
		expect(sorted(drawMany(() => RandomUtils.variationInt(2)))).toEqual([-2, -1, 0, 1, 2]);
	});

	it("enumPick only draws the values of a numeric enum, never its names", () => {
		expect(sorted(drawMany(() => RandomUtils.enumPick(DayOfTheWeek)))).toEqual([0, 1, 2, 3, 4, 5, 6]);
	});
});

describe("RandomUtils.deterministicShuffle", () => {
	const values = [1, 2, 3, 4, 5, 6, 7, 8];

	it("keeps the permutation of a seed stable across versions, as the cooking slots rely on it", () => {
		expect(RandomUtils.deterministicShuffle(values, 42)).toEqual([7, 8, 2, 6, 3, 1, 5, 4]);
	});

	it("treats a null seed like the seed 1 and reads the seed as an unsigned 32 bits integer", () => {
		expect(RandomUtils.deterministicShuffle(values, 0)).toEqual(RandomUtils.deterministicShuffle(values, 1));
		expect(RandomUtils.deterministicShuffle(values, 2 ** 32 + 42)).toEqual(RandomUtils.deterministicShuffle(values, 42));
	});

	it("does not modify the given array", () => {
		const input = [...values];

		RandomUtils.deterministicShuffle(input, 42);

		expect(input).toEqual(values);
	});
});

describe("RandomUtils.weightedPick", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	function rollAt(value: number): void {
		vi.spyOn(RandomUtils.crowniclesRandom, "real").mockReturnValue(value);
	}

	it("draws the next element when the roll falls exactly on a weight boundary", () => {
		rollAt(1);

		expect(RandomUtils.weightedPick(["first", "second", "third"], () => 1)).toBe("second");
	});

	it("rolls between zero and the total weight", () => {
		const real = vi.spyOn(RandomUtils.crowniclesRandom, "real");

		RandomUtils.weightedPick(["a", "b"], value => (value === "a" ? 2 : 3));

		expect(real).toHaveBeenCalledWith(0, 5);
	});

	it("falls back on the last element when the roll reaches the total weight", () => {
		rollAt(3);

		expect(RandomUtils.weightedPick(["first", "second", "third"], () => 1)).toBe("third");
	});

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

	it("keeps a drawn null or undefined element instead of replacing it by the last one", () => {
		for (let i = 0; i < 1000; i++) {
			expect(RandomUtils.weightedPick([null, "never"], value => (value === null ? 1 : 0))).toBeNull();
			expect(RandomUtils.weightedPick([undefined, "never"], value => (value === undefined ? 1 : 0))).toBeUndefined();
		}
	});
});
