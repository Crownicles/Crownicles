import {
	describe, expect, it, vi
} from "vitest";
import Player from "../../../../src/core/database/game/models/Player";
import { TopConstants } from "../../../../../Lib/src/constants/TopConstants";

describe("Player.isInactive", () => {
	const now = Date.UTC(2026, 6, 17);

	function createPlayer(startTravelDate: Date, insideCity: boolean): Player {
		const player = Object.create(Player.prototype) as Player;
		Object.assign(player, {
			insideCity,
			startTravelDate
		});
		return player;
	}

	it("does not mark a player inside a city as inactive", () => {
		vi.spyOn(Date, "now").mockReturnValue(now);

		expect(createPlayer(new Date(0), true).isInactive()).toBe(false);
	});

	it("marks a player outside a city as inactive after fifteen days", () => {
		vi.spyOn(Date, "now").mockReturnValue(now);
		const startTravelDate = new Date(now - TopConstants.FIFTEEN_DAYS - 1);

		expect(createPlayer(startTravelDate, false).isInactive()).toBe(true);
	});

	it("keeps a recent player outside a city active", () => {
		vi.spyOn(Date, "now").mockReturnValue(now);
		const startTravelDate = new Date(now - TopConstants.FIFTEEN_DAYS + 1);

		expect(createPlayer(startTravelDate, false).isInactive()).toBe(false);
	});
});
