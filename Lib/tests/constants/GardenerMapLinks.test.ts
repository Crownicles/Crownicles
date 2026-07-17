import {
	describe, expect, it
} from "vitest";
import { PlantConstants } from "../../src/constants/PlantConstants";

describe("gardener map links", () => {
	it("allows each configured route in both directions", () => {
		expect(new Set(PlantConstants.GARDENER_MAP_LINKS)).toEqual(new Set([
			8, 69,
			46, 59,
			32, 56
		]));
	});
});