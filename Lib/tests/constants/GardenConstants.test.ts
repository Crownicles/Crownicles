import {
	describe, expect, it
} from "vitest";
import { GardenConstants } from "../../src/constants/GardenConstants";
import { GardenEarthQuality } from "../../src/types/GardenEarthQuality";

describe("GardenConstants growth", () => {
	it("slows the growth down on a poorer earth, rounding up to the second", () => {
		expect(GardenConstants.getEffectiveGrowthTime(101, GardenEarthQuality.RICH)).toBe(101);
		expect(GardenConstants.getEffectiveGrowthTime(101, GardenEarthQuality.AVERAGE)).toBe(152);
		expect(GardenConstants.getEffectiveGrowthTime(101, GardenEarthQuality.POOR)).toBe(202);
	});

	it("advances a twelfth of the effective growth time per watering", () => {
		expect(GardenConstants.getWateringAdvanceSeconds(1200, GardenEarthQuality.RICH)).toBe(100);
		expect(GardenConstants.getWateringAdvanceSeconds(1200, GardenEarthQuality.POOR)).toBe(200);
		expect(GardenConstants.getWateringAdvanceSeconds(1206, GardenEarthQuality.RICH)).toBe(101);
	});
});
