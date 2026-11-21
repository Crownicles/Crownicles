import { describe, it, expect } from "vitest";
import { frac, median } from "../../src/utils/MathUtils";

describe("frac", () => {
	it("should return fractional part of positive numbers", () => {
		expect(frac(3.7)).toBeCloseTo(0.7);
		expect(frac(1.25)).toBeCloseTo(0.25);
	});

	it("should return 0 for integers", () => {
		expect(frac(5)).toBe(0);
		expect(frac(0)).toBe(0);
	});

	it("should return absolute fractional part for negative numbers", () => {
		expect(frac(-3.7)).toBeCloseTo(0.7);
		expect(frac(-1.25)).toBeCloseTo(0.25);
	});

	it("should always return value in [0, 1)", () => {
		for (const x of [-100.99, -0.5, 0.1, 42.999]) {
			const result = frac(x);
			expect(result).toBeGreaterThanOrEqual(0);
			expect(result).toBeLessThan(1);
		}
	});
});

describe("median", () => {
	it("returns the middle value of an odd count, whatever the order", () => {
		expect(median([9, 1, 5])).toBe(5);
		expect(median([7])).toBe(7);
	});

	it("returns the mean of the two middle values of an even count", () => {
		expect(median([10, 1, 4, 3])).toBe(3.5);
	});

	it("sorts numerically and not alphabetically", () => {
		expect(median([10, 9, 100])).toBe(10);
	});

	it("does not reorder the given list", () => {
		const values = [3, 1, 2];

		median(values);

		expect(values).toEqual([3, 1, 2]);
	});
});
