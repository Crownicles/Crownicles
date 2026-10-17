import { describe, it, expect } from "vitest";
import { missionInterface } from "../../../src/core/missions/interfaces/upgradeHomeLevel";

describe("upgradeHomeLevel mission", () => {
	describe("areParamsMatchingVariantAndBlob", () => {
		it("should match when the home level reaches the variant threshold", () => {
			expect(missionInterface.areParamsMatchingVariantAndBlob(3, { homeLevel: 3 }, null as unknown as Buffer)).toBe(true);
		});

		it("should match when the home level is above the variant threshold", () => {
			expect(missionInterface.areParamsMatchingVariantAndBlob(3, { homeLevel: 5 }, null as unknown as Buffer)).toBe(true);
		});

		it("should not match when the home level is below the variant threshold", () => {
			expect(missionInterface.areParamsMatchingVariantAndBlob(3, { homeLevel: 2 }, null as unknown as Buffer)).toBe(false);
		});
	});
});
