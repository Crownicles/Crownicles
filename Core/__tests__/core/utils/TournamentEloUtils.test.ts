import {
	describe, expect, it
} from "vitest";
import { EloUtils } from "../../../src/core/utils/EloUtils";

describe("EloUtils tournament ratings", () => {
	it("uses the same thresholds for tournament ratings", () => {
		expect(EloUtils.getKFactorFromGlory(1500)).toBe(32);
		expect(EloUtils.getKFactorFromGlory(2200)).toBe(24);
		expect(EloUtils.getKFactorFromGlory(2500)).toBe(16);
		expect(EloUtils.getKFactorFromGlory(3500)).toBe(12);
		expect(EloUtils.getKFactorFromGlory(4000)).toBe(8);
	});
});