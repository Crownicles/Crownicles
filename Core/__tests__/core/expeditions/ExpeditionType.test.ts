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
			[MapLocationConstants.TYPES.LAKE]: expeditionTypes.SWAMP,
			[MapLocationConstants.TYPES.RUINS]: expeditionTypes.RUINS,
			[MapLocationConstants.TYPES.ROAD]: expeditionTypes.PLAINS
		});
	});

	it("keeps an explicit expedition override for locations outside V1", () => {
		const mapLocation = {
			type: MapLocationConstants.TYPES.FOREST,
			expeditionType: ExpeditionConstants.EXPEDITION_LOCATION_TYPES.CAVE
		} as MapLocation;

		expect(getExpeditionTypeFromMapLocation(mapLocation)).toBe(ExpeditionConstants.EXPEDITION_LOCATION_TYPES.CAVE);
	});

	it("derives the expedition biome proposed for the continent locations", () => {
		const migratedLocations: [number, ExpeditionLocationType, boolean][] = [
			[3, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.SWAMP, true],
			[5, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.RUINS, true],
			[7, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.DESERT, false],
			[13, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.SWAMP, true],
			[16, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.PLAINS, false],
			[17, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.DESERT, true],
			[19, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.DESERT, true],
			[21, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.RUINS, true],
			[22, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.FOREST, false],
			[23, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.CAVE, true],
			[24, ExpeditionConstants.EXPEDITION_LOCATION_TYPES.MOUNTAIN, true]
		];

		for (const [id, expectedType, hasOverride] of migratedLocations) {
			const mapLocation = readMapLocation(id);

			expect(mapLocation.expeditionType).toBe(hasOverride ? expectedType : undefined);
			expect(getExpeditionTypeFromMapLocation(mapLocation)).toBe(expectedType);
		}
	});
});