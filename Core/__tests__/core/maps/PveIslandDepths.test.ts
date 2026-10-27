import {
	describe, expect, it
} from "vitest";
import { MapCache } from "../../../src/core/maps/MapCache";
import { MapLocationDataController } from "../../../src/data/MapLocation";
import { MapLinkDataController } from "../../../src/data/MapLink";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";

describe("PVE island depths", () => {
	const depths = MapCache.computePveIslandMapDepths();
	const islandLocations = MapLocationDataController.instance.getWithAttributes([MapConstants.MAP_ATTRIBUTES.PVE_ISLAND]);

	it("gives a depth to every island location", () => {
		expect(islandLocations.length).toBeGreaterThan(0);
		for (const location of islandLocations) {
			expect(depths.get(location.id)).toBeGreaterThanOrEqual(1);
		}
	});

	it("gives the depth 1 to the locations reached from an island entry", () => {
		const entries = MapLocationDataController.instance.getWithAttributes([MapConstants.MAP_ATTRIBUTES.PVE_ISLAND_ENTRY]);
		for (const entry of entries) {
			for (const link of MapLinkDataController.instance.getLinksByMapStart(entry.id)) {
				expect(depths.get(link.endMap)).toBe(1);
			}
		}
	});

	it("never makes a location deeper than one step after a location leading to it", () => {
		for (const location of islandLocations) {
			for (const link of MapLinkDataController.instance.getLinksByMapStart(location.id)) {
				if (depths.has(link.endMap)) {
					expect(depths.get(link.endMap)!).toBeLessThanOrEqual(depths.get(location.id)! + 1);
				}
			}
		}
	});
});
