import {
	describe, expect, it, vi
} from "vitest";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { Constants } from "../../../../Lib/src/constants/Constants";
import type { Player } from "../../../src/core/database/game/models/Player";
import { PlayerSmallEvents } from "../../../src/core/database/game/models/PlayerSmallEvent";
import type { MapLink } from "../../../src/data/MapLink";
import { BlockingUtils } from "../../../src/core/utils/BlockingUtils";

// Mock Maps so we can control whether the player is on the PvE island
const isOnPveIslandMock = vi.fn();
const getNextPlayerAvailableMapsMock = vi.fn();
const startTravelMock = vi.fn();
vi.mock("../../../src/core/maps/Maps", () => ({
	Maps: {
		isOnPveIsland: (player: Player) => isOnPveIslandMock(player),
		getNextPlayerAvailableMaps: (player: Player) => getNextPlayerAvailableMapsMock(player),
		startTravel: (player: Player, mapLink: MapLink, time: number) => startTravelMock(player, mapLink, time)
	}
}));

vi.mock("../../../src/core/maps/MapCache", () => ({
	MapCache: {
		allPveMapLinks: [12]
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

const getMapLinkByLocationsMock = vi.fn();
vi.mock("../../../src/data/MapLink", () => ({
	MapLinkDataController: {
		instance: {
			getLinkByLocations: (startMap: number, endMap: number) => getMapLinkByLocationsMock(startMap, endMap)
		}
	}
}));

const getMapLocationByIdMock = vi.fn();
vi.mock("../../../src/data/MapLocation", () => ({
	MapLocationDataController: {
		instance: {
			getById: (mapId: number) => getMapLocationByIdMock(mapId)
		}
	}
}));

vi.mock("../../../src/core/database/game/models/PlayerSmallEvent", () => ({
	PlayerSmallEvents: {
		removeSmallEventsOfPlayer: vi.fn()
	}
}));

vi.mock("../../../src/core/utils/BlockingUtils", () => ({
	BlockingUtils: {
		blockPlayerUntil: vi.fn(),
		unblockPlayer: vi.fn()
	}
}));

let capturedEndCallback: ((collector: { getFirstReaction: () => unknown }, response: unknown[]) => Promise<void>) | undefined;
vi.mock("../../../src/core/utils/ReactionsCollector", () => ({
	ReactionCollectorInstance: class {
		constructor(_collector: unknown, _context: unknown, _options: unknown, endCallback: typeof capturedEndCallback) {
			capturedEndCallback = endCallback;
		}

		block(): this {
			return this;
		}

		build(): this {
			return this;
		}
	}
}));

// Import after mocks so the module under test picks up the mocked deps
const {
	canStayInCity, canAutoChooseDestination, chooseDestination, mustForceStayInCity
} = await import("../../../src/core/report/ReportDestinationService");

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

describe("chooseDestination collector", () => {
	it("retries travel persistence after a connection setup timeout", async () => {
		capturedEndCallback = undefined;
		vi.clearAllMocks();
		isOnPveIslandMock.mockReturnValue(true);
		getNextPlayerAvailableMapsMock.mockReturnValue([2, 3]);
		getMapLinkByLocationsMock.mockReturnValue({
			id: 12, endMap: 2, tripDuration: 10
		});
		getMapLocationByIdMock.mockReturnValue({ type: "cavern" });

		const connectionTimeout = Object.assign(new Error("Connection timeout: failed to create socket"), {
			name: "SequelizeConnectionError",
			parent: {
				code: "ER_CONNECTION_TIMEOUT",
				sql: null
			}
		});
		startTravelMock
			.mockRejectedValueOnce(connectionTimeout)
			.mockResolvedValueOnce(undefined);

		const player = {
			id: 1,
			keycloakId: "destination-player",
			mapLinkId: 1,
			getDestinationId: (): number => 1,
			getPreviousMapId: (): number => 0,
			effectRemainingTime: (): number => 0
		} as Player;

		await chooseDestination({} as never, player, null, [], { allowStayInCity: false });

		if (!capturedEndCallback) {
			throw new Error("Expected destination collector callback to be set");
		}

		await expect(capturedEndCallback({
			getFirstReaction: () => ({
				reaction: {
					type: "chooseDestination",
					data: { mapId: 2 }
				}
			})
		}, [])).resolves.toBeUndefined();

		expect(startTravelMock).toHaveBeenCalledTimes(2);
		expect(BlockingUtils.unblockPlayer).toHaveBeenCalledWith(
			player.keycloakId,
			BlockingConstants.REASONS.CHOOSE_DESTINATION
		);
	});

	it("releases the destination lock when travel persistence fails", async () => {
		capturedEndCallback = undefined;
		vi.clearAllMocks();
		isOnPveIslandMock.mockReturnValue(true);
		getNextPlayerAvailableMapsMock.mockReturnValue([2, 3]);
		getMapLinkByLocationsMock.mockReturnValue({
			id: 12, endMap: 2, tripDuration: 10
		});
		getMapLocationByIdMock.mockReturnValue({ type: "cavern" });
		vi.mocked(PlayerSmallEvents.removeSmallEventsOfPlayer).mockResolvedValue(undefined);
		startTravelMock.mockRejectedValue(new Error("Database connection timed out"));

		const player = {
			id: 1,
			keycloakId: "destination-player",
			mapLinkId: 1,
			getDestinationId: (): number => 1,
			getPreviousMapId: (): number => 0,
			effectRemainingTime: (): number => 0
		} as Player;

		await chooseDestination({} as never, player, null, [], { allowStayInCity: false });

		if (!capturedEndCallback) {
			throw new Error("Expected destination collector callback to be set");
		}

		await expect(capturedEndCallback({
			getFirstReaction: () => ({
				reaction: {
					type: "chooseDestination",
					data: { mapId: 2 }
				}
			})
		}, [])).rejects.toThrow("Database connection timed out");

		expect(BlockingUtils.unblockPlayer).toHaveBeenCalledWith(
			player.keycloakId,
			BlockingConstants.REASONS.CHOOSE_DESTINATION
		);
	});
});
