import { describe, expect, it } from "vitest";
import { ExpeditionConstants } from "../../src/constants/ExpeditionConstants";
import { MapLocationConstants } from "../../src/constants/MapLocationConstants";
import { getExpeditionLocationType } from "../../src/utils/ExpeditionUtils";

describe("getExpeditionLocationType", () => {
	it("should resolve the swamp map type", () => {
		expect(getExpeditionLocationType(MapLocationConstants.TYPES.SWAMP)).toBe(
			ExpeditionConstants.EXPEDITION_LOCATION_TYPES.SWAMP
		);
	});

	it("should prioritize an explicit expedition type", () => {
		expect(getExpeditionLocationType(
			MapLocationConstants.TYPES.FOREST,
			ExpeditionConstants.EXPEDITION_LOCATION_TYPES.CAVE
		)).toBe(ExpeditionConstants.EXPEDITION_LOCATION_TYPES.CAVE);
	});

	it("should fall back to plains for unmapped map types", () => {
		expect(getExpeditionLocationType("unknown")).toBe(
			ExpeditionConstants.EXPEDITION_LOCATION_TYPES.PLAINS
		);
	});
});