import {
	describe, expect, it
} from "vitest";
import { formatPotionUsagesPrefix } from "../../src/utils/PotionDisplayUtils";

describe("formatPotionUsagesPrefix", () => {
	it("displays remaining and maximum usages for multi-use potions", () => {
		expect(formatPotionUsagesPrefix(2, 4)).toBe("**2/4** | ");
	});

	it("defaults remaining usages to the maximum", () => {
		expect(formatPotionUsagesPrefix(undefined, 4)).toBe("**4/4** | ");
	});

	it("hides usages for single-use and non-fight potions", () => {
		expect(formatPotionUsagesPrefix(1, 1)).toBe("");
		expect(formatPotionUsagesPrefix(undefined, undefined)).toBe("");
	});
});