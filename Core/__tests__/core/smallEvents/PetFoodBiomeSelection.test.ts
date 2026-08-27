import {
	afterEach, beforeEach, describe, expect, it, vi
} from "vitest";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { MapLocationConstants } from "../../../../Lib/src/constants/MapLocationConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import Player from "../../../src/core/database/game/models/Player";
import { TravelTime } from "../../../src/core/maps/TravelTime";
import { getFoodType } from "../../../src/core/smallEvents/petFood";
import { MapLinkDataController } from "../../../src/data/MapLink";
import { MapLocationDataController } from "../../../src/data/MapLocation";

const player = { mapLinkId: 12 } as Player;
const startMapId = MapConstants.LOCATIONS_IDS.ROAD_OF_WONDERS + 1;
const endMapId = MapConstants.LOCATIONS_IDS.ROAD_OF_WONDERS + 2;

describe("pet food biome selection", () => {
	beforeEach(() => {
		vi.spyOn(MapLinkDataController.instance, "getById").mockReturnValue({
			id: player.mapLinkId,
			startMap: startMapId,
			endMap: endMapId
		} as never);
		vi.spyOn(MapLocationDataController.instance, "getById").mockImplementation(mapId => ({
			id: mapId,
			type: mapId === startMapId ? MapLocationConstants.TYPES.FOREST : MapLocationConstants.TYPES.RIVER
		}) as never);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("uses the departure biome near the start of the journey", () => {
		vi.spyOn(TravelTime, "getTravelProgress").mockReturnValue(0.2);
		vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive")
			.mockReturnValueOnce(0.7)
			.mockReturnValueOnce(0.5);

		expect(getFoodType(player)).toBe("vegetarian");
	});

	it("uses the destination biome near the end of the journey", () => {
		vi.spyOn(TravelTime, "getTravelProgress").mockReturnValue(0.8);
		vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive")
			.mockReturnValueOnce(0.7)
			.mockReturnValueOnce(0.5);

		expect(getFoodType(player)).toBe("meat");
	});

	it("keeps the Route des Merveilles soup outcome", () => {
		const random = vi.spyOn(RandomUtils.crowniclesRandom, "realZeroToOneInclusive");
		vi.spyOn(MapLinkDataController.instance, "getById").mockReturnValue({
			id: player.mapLinkId,
			startMap: MapConstants.LOCATIONS_IDS.ROAD_OF_WONDERS,
			endMap: endMapId
		} as never);

		expect(getFoodType(player)).toBe("soup");
		expect(random).not.toHaveBeenCalled();
	});
});
