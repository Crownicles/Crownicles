import { describe, it, expect } from "vitest";
import { frac } from "../../src/utils/MathUtils";

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
