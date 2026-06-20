import {
	describe, expect, it, vi
} from "vitest";
import { Constants } from "../../../../Lib/src/constants/Constants";
import type { Player } from "../../../src/core/database/game/models/Player";
import type { MapLink } from "../../../src/data/MapLink";

// Mock Maps so we can control whether the player is on the PvE island
const isOnPveIslandMock = vi.fn();
vi.mock("../../../src/core/maps/Maps", () => ({
	Maps: {
		isOnPveIsland: (player: Player) => isOnPveIslandMock(player)
	}
}));

// Mock CityDataController so canStayInCity does not depend on real city data
const getCityByMapIdMock = vi.fn();
vi.mock("../../../src/data/City", () => ({
	CityDataController: {
		instance: {
			getCityByMapId: (mapId: number) => getCityByMapIdMock(mapId)
		}
	}
}));

// Import after mocks so the module under test picks up the mocked deps
const { canStayInCity, canAutoChooseDestination, mustForceStayInCity } = await import("../../../src/core/report/ReportDestinationService");

const LAST_MAP_LINK = Constants.BEGINNING.LAST_MAP_LINK;

const makePlayer = (mapLinkId: number, destinationId: number): Player =>
	({
		mapLinkId,
		getDestinationId: (): number => destinationId
	} as unknown as Player);

const fakeLink = {} as MapLink;

describe("canStayInCity", () => {
	it("is false when staying in city is not allowed", () => {
		getCityByMapIdMock.mockReturnValue({ id: "boug_coton" });
		expect(canStayInCity(makePlayer(10, 6), null, false)).toBe(false);
	});

	it("is false when teleported by a forced link", () => {
		getCityByMapIdMock.mockReturnValue({ id: "boug_coton" });
		expect(canStayInCity(makePlayer(10, 6), fakeLink, true)).toBe(false);
	});

	it("is true when standing on a city map and allowed", () => {
		getCityByMapIdMock.mockReturnValue({ id: "boug_coton" });
		expect(canStayInCity(makePlayer(10, 6), null, true)).toBe(true);
	});

	it("is false when the current map is not a city", () => {
		getCityByMapIdMock.mockReturnValue(undefined);
		expect(canStayInCity(makePlayer(10, 99), null, true)).toBe(false);
	});
});

describe("mustForceStayInCity", () => {
	it("is false when the outcome does not request it", () => {
		getCityByMapIdMock.mockReturnValue({ id: "boug_coton" });
		expect(mustForceStayInCity(makePlayer(10, 6), null, false)).toBe(false);
	});

	it("is false when teleported by a forced link", () => {
		getCityByMapIdMock.mockReturnValue({ id: "boug_coton" });
		expect(mustForceStayInCity(makePlayer(10, 6), fakeLink, true)).toBe(false);
	});

	it("is false when the current map is not a city", () => {
		getCityByMapIdMock.mockReturnValue(undefined);
		expect(mustForceStayInCity(makePlayer(10, 99), null, true)).toBe(false);
	});

	it("is true when requested while standing on a city map and not teleported", () => {
		getCityByMapIdMock.mockReturnValue({ id: "boug_coton" });
		expect(mustForceStayInCity(makePlayer(10, 6), null, true)).toBe(true);
	});
});

describe("canAutoChooseDestination", () => {
	it("is false when the player may stay in the city", () => {
		isOnPveIslandMock.mockReturnValue(false);
		expect(canAutoChooseDestination(makePlayer(10, 6), fakeLink, [1, 2], true)).toBe(false);
	});

	it("auto-chooses when a forced link is set (off PvE island)", () => {
		isOnPveIslandMock.mockReturnValue(false);
		expect(canAutoChooseDestination(makePlayer(10, 6), fakeLink, [1, 2], false)).toBe(true);
	});

	it("auto-chooses with a single destination off PvE island", () => {
		isOnPveIslandMock.mockReturnValue(false);
		expect(canAutoChooseDestination(makePlayer(10, 6), null, [1], false)).toBe(true);
	});

	it("does not auto-choose with a single destination when on the very last map link", () => {
		isOnPveIslandMock.mockReturnValue(false);
		expect(canAutoChooseDestination(makePlayer(LAST_MAP_LINK, 6), null, [1], false)).toBe(false);
	});

	it("does not auto-choose on the PvE island with several destinations", () => {
		isOnPveIslandMock.mockReturnValue(true);
		expect(canAutoChooseDestination(makePlayer(10, 6), fakeLink, [1, 2], false)).toBe(false);
	});

	it("auto-chooses a forced link on the PvE island when there is a single destination", () => {
		isOnPveIslandMock.mockReturnValue(true);
		expect(canAutoChooseDestination(makePlayer(10, 6), fakeLink, [1], false)).toBe(true);
	});

	it("does not auto-choose with several destinations and no forced link", () => {
		isOnPveIslandMock.mockReturnValue(false);
		expect(canAutoChooseDestination(makePlayer(10, 6), null, [1, 2], false)).toBe(false);
	});
});
