import {
	describe, expect, it
} from "vitest";
import { ExpeditionConstants } from "../../src/constants/ExpeditionConstants";
import {
	getDifficultyCategoryName, getDurationRangesArray, getRewardCategoryName, getRiskCategoryName
} from "../../src/utils/ExpeditionUtils";

type DisplayCategories = Record<string, { MAX: number; NAME: string }>;

/**
 * Every category must include its MAX and the value just above must fall in the next one
 */
function expectBoundaries(categories: DisplayCategories, categoryOf: (value: number) => string, step: number): void {
	const ordered = Object.values(categories);
	ordered.forEach((category, index) => {
		expect(categoryOf(category.MAX)).toBe(category.NAME);
		const next = ordered[index + 1] ?? category;
		expect(categoryOf(category.MAX + step)).toBe(next.NAME);
	});
}

describe("ExpeditionUtils display categories", () => {
	it("sorts a risk rate in its category, bounds included", () => {
		expectBoundaries(ExpeditionConstants.RISK_DISPLAY_CATEGORIES, getRiskCategoryName, 1);
		expect(getRiskCategoryName(0)).toBe("trivial");
	});

	it("sorts a difficulty in its category, bounds included", () => {
		expectBoundaries(ExpeditionConstants.DIFFICULTY_DISPLAY_CATEGORIES, getDifficultyCategoryName, 1);
		expect(getDifficultyCategoryName(0)).toBe("trivial");
	});

	it("sorts a reward index in its category, bounds included", () => {
		expectBoundaries(ExpeditionConstants.REWARD_DISPLAY_CATEGORIES, getRewardCategoryName, 1);
		expect(getRewardCategoryName(0)).toBe("meager");
	});
});

describe("getDurationRangesArray", () => {
	it("lists the short, medium and long duration ranges in this order", () => {
		const ranges = ExpeditionConstants.DURATION_RANGES;

		expect(getDurationRangesArray()).toEqual([
			{
				min: ranges.SHORT.MIN, max: ranges.SHORT.MAX
			},
			{
				min: ranges.MEDIUM.MIN, max: ranges.MEDIUM.MAX
			},
			{
				min: ranges.LONG.MIN, max: ranges.LONG.MAX
			}
		]);
	});
});
