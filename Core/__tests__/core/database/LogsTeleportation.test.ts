import {
	beforeEach, describe, expect, it, vi
} from "vitest";

import { LogsDatabase } from "../../../src/core/database/logs/LogsDatabase";
import { MapLink } from "../../../src/data/MapLink";
import { LogsMapLinks } from "../../../src/core/database/logs/models/LogsMapLinks";
import { LogsPlayersTeleportations } from "../../../src/core/database/logs/models/LogsPlayersTeleportations";

type MapLinkEnds = Pick<MapLink, "startMap" | "endMap">;

const LOG_PLAYER_ID = 42;

const ORIGIN_MAP_LINK: MapLinkEnds = {
	startMap: 1, endMap: 2
};
const NEW_MAP_LINK: MapLinkEnds = {
	startMap: 3, endMap: 4
};

const LOGS_ORIGIN_MAP_LINK_ID = 5;
const LOGS_NEW_MAP_LINK_ID = 9;

const LOGS_MAP_LINK_IDS = new Map<string, number>([
	[`${ORIGIN_MAP_LINK.startMap}-${ORIGIN_MAP_LINK.endMap}`, LOGS_ORIGIN_MAP_LINK_ID],
	[`${NEW_MAP_LINK.startMap}-${NEW_MAP_LINK.endMap}`, LOGS_NEW_MAP_LINK_ID]
]);

type FindOrCreateOptions = {
	where: {
		start: number;
		end: number;
	};
};

function asMapLink(mapLinkEnds: MapLinkEnds): MapLink {
	return mapLinkEnds as MapLink;
}

describe("LogsDatabase teleportation", () => {
	const logs = Object.create(LogsDatabase.prototype) as LogsDatabase;

	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(LogsDatabase as unknown as { findOrCreatePlayer: () => Promise<{ id: number }> }, "findOrCreatePlayer")
			.mockResolvedValue({ id: LOG_PLAYER_ID });
		vi.spyOn(LogsMapLinks, "findOrCreate").mockImplementation(((options: FindOrCreateOptions) => Promise.resolve([
			{ id: LOGS_MAP_LINK_IDS.get(`${options.where.start}-${options.where.end}`) },
			false
		])) as unknown as typeof LogsMapLinks.findOrCreate);
		vi.spyOn(LogsPlayersTeleportations, "create").mockResolvedValue({} as LogsPlayersTeleportations);
	});

	it("stores the logs map link ids found from the start and end of the map links", async () => {
		await logs.logTeleportation("player-keycloak-id", asMapLink(ORIGIN_MAP_LINK), asMapLink(NEW_MAP_LINK));

		expect(LogsMapLinks.findOrCreate).toHaveBeenCalledWith({
			where: {
				start: ORIGIN_MAP_LINK.startMap, end: ORIGIN_MAP_LINK.endMap
			}
		});
		expect(LogsMapLinks.findOrCreate).toHaveBeenCalledWith({
			where: {
				start: NEW_MAP_LINK.startMap, end: NEW_MAP_LINK.endMap
			}
		});
		expect(LogsPlayersTeleportations.create).toHaveBeenCalledWith(expect.objectContaining({
			playerId: LOG_PLAYER_ID,
			originMapLinkId: LOGS_ORIGIN_MAP_LINK_ID,
			newMapLinkId: LOGS_NEW_MAP_LINK_ID
		}));
	});

	it("does not mix up the origin and the new map link", async () => {
		await logs.logTeleportation("player-keycloak-id", asMapLink(NEW_MAP_LINK), asMapLink(ORIGIN_MAP_LINK));

		expect(LogsPlayersTeleportations.create).toHaveBeenCalledWith(expect.objectContaining({
			originMapLinkId: LOGS_NEW_MAP_LINK_ID,
			newMapLinkId: LOGS_ORIGIN_MAP_LINK_ID
		}));
	});
});
