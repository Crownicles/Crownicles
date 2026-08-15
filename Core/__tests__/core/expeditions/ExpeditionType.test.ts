import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import {
	ExpeditionConstants, ExpeditionLocationType
} from "../../../../Lib/src/constants/ExpeditionConstants";
import { MapLocationConstants } from "../../../../Lib/src/constants/MapLocationConstants";
import { MapLocation } from "../../../src/data/MapLocation";
import { getExpeditionTypeFromMapLocation } from "../../../src/core/expeditions/ExpeditionService";

const mapLocationsPath = resolve(__dirname, "../../../resources/mapLocations");

function readMapLocation(id: number): MapLocation {
	return JSON.parse(readFileSync(resolve(mapLocationsPath, `${id}.json`), "utf-8")) as MapLocation;
}

describe("Expedition type resolution", () => {
	it("maps map location types to their expedition biomes", () => {
		const expeditionTypes = ExpeditionConstants.EXPEDITION_LOCATION_TYPES;

		expect(ExpeditionConstants.MAP_TYPE_TO_EXPEDITION_TYPE).toMatchObject({
			[MapLocationConstants.TYPES.DESERT]: expeditionTypes.DESERT,
			[MapLocationConstants.TYPES.MOUNTAIN]: expeditionTypes.MOUNTAIN,
			[MapLocationConstants.TYPES.RUINS]: expeditionTypes.RUINS,
			[MapLocationConstants.TYPES.SWAMP]: expeditionTypes.SWAMP
		});
	});

	it("keeps an explicit expedition override for locations outside V1", () => {
		const mapLocation = {
			type: MapLocationConstants.TYPES.FOREST,
			expeditionType: ExpeditionConstants.EXPEDITION_LOCATION_TYPES.CAVE
		} as MapLocation;

		expect(getExpeditionTypeFromMapLocation(mapLocation)).toBe(ExpeditionConstants.EXPEDITION_LOCATION_TYPES.CAVE);
	});

	it("derives the current expedition biome for the five migrated locations", () => {
		const migratedLocations: [number, ExpeditionLocationType][] = [
			[5, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.RUINS],
			[13, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.SWAMP],
			[17, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.DESERT],
			[19, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.DESERT],
			[24, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.MOUNTAIN]
		];

		for (const [id, expectedType] of migratedLocations) {
			const mapLocation = readMapLocation(id);

			expect(mapLocation.expeditionType).toBeUndefined();
			expect(getExpeditionTypeFromMapLocation(mapLocation)).toBe(expectedType);
		}
	});
});