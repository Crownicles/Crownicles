import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import { smallEventFuncs } from "../../src/core/smallEvents/gardener";
import { Maps } from "../../src/core/maps/Maps";
import { MapLinkDataController } from "../../src/data/MapLink";
import { MapLocationDataController } from "../../src/data/MapLocation";
import { PlayerSmallEvents } from "../../src/core/database/game/models/PlayerSmallEvent";
import { MapLocationConstants } from "../../../Lib/src/constants/MapLocationConstants";

describe("gardener small event", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(Maps, "isOnContinent").mockReturnValue(true);
		vi.spyOn(PlayerSmallEvents, "playerSmallEventCount").mockResolvedValue(0);
	});

	it("is available on paths connected to a forest in both directions", async () => {
		vi.spyOn(MapLocationDataController.instance, "getById")
			.mockImplementation(mapId => ({
				type: mapId === 2 ? MapLocationConstants.TYPES.FOREST : MapLocationConstants.TYPES.PLAINS
			} as never));

		for (const link of [
			{ startMap: 1, endMap: 2 },
			{ startMap: 2, endMap: 1 }
		]) {
			vi.spyOn(MapLinkDataController.instance, "getById")
				.mockReturnValue({ id: 1, tripDuration: 1, ...link } as never);

			await expect(smallEventFuncs.canBeExecuted({
				id: 1,
				mapLinkId: 1
			} as never)).resolves.toBe(true);
		}
	});

	it("is not available away from forests, on an unknown path, outside the continent or twice on a path", async () => {
		const player = {
			id: 1,
			mapLinkId: 1
		} as never;
		vi.spyOn(MapLocationDataController.instance, "getById")
			.mockImplementation(mapId => ({
				type: mapId === 2 ? MapLocationConstants.TYPES.FOREST : MapLocationConstants.TYPES.PLAINS
			} as never));
		vi.spyOn(MapLinkDataController.instance, "getById")
			.mockReturnValue({
				id: 1, tripDuration: 1, startMap: 1, endMap: 3
			} as never);
		await expect(smallEventFuncs.canBeExecuted(player, {} as never)).resolves.toBe(false);

		vi.spyOn(MapLinkDataController.instance, "getById").mockReturnValue(undefined);
		await expect(smallEventFuncs.canBeExecuted(player, {} as never)).resolves.toBe(false);

		vi.spyOn(MapLinkDataController.instance, "getById")
			.mockReturnValue({
				id: 1, tripDuration: 1, startMap: 1, endMap: 2
			} as never);
		vi.spyOn(PlayerSmallEvents, "playerSmallEventCount").mockResolvedValue(1);
		await expect(smallEventFuncs.canBeExecuted(player, {} as never)).resolves.toBe(false);

		vi.spyOn(PlayerSmallEvents, "playerSmallEventCount").mockResolvedValue(0);
		vi.spyOn(Maps, "isOnContinent").mockReturnValue(false);
		await expect(smallEventFuncs.canBeExecuted(player, {} as never)).resolves.toBe(false);
	});
});