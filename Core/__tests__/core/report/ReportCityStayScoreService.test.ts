import {
	describe, expect, it
} from "vitest";
import Player from "../../../src/core/database/game/models/Player";
import { getRewardedCityStayMinutes } from "../../../src/core/report/ReportCityStayScoreService";
import { ReportConstants } from "../../../../Lib/src/constants/ReportConstants";

const ONE_MINUTE_MS = 60_000;
const NOW = new Date(Date.UTC(2026, 9, 17, 12));

function createPlayer(insideCity: boolean, cityArrivalDate: Date | null): Player {
	const player = Object.create(Player.prototype) as Player;
	Object.assign(player, {
		insideCity,
		cityArrivalDate
	});
	return player;
}

function minutesBeforeNow(minutes: number): Date {
	return new Date(NOW.valueOf() - minutes * ONE_MINUTE_MS);
}

describe("getRewardedCityStayMinutes", () => {
	it("rewards every minute spent in the city since the arrival", () => {
		expect(getRewardedCityStayMinutes(createPlayer(true, minutesBeforeNow(95)), NOW)).toBe(95);
	});

	it("caps the stay like the travel time of a report", () => {
		const longStay = createPlayer(true, minutesBeforeNow(ReportConstants.TIME_LIMIT * 3));

		expect(getRewardedCityStayMinutes(longStay, NOW)).toBe(ReportConstants.TIME_LIMIT);
	});

	it("rewards nothing to a player who is not stationary in a city", () => {
		expect(getRewardedCityStayMinutes(createPlayer(false, minutesBeforeNow(95)), NOW)).toBe(0);
	});

	it("rewards nothing when the arrival is unknown", () => {
		expect(getRewardedCityStayMinutes(createPlayer(true, null), NOW)).toBe(0);
	});

	it("rewards nothing for an arrival recorded in the future", () => {
		expect(getRewardedCityStayMinutes(createPlayer(true, minutesBeforeNow(-10)), NOW)).toBe(0);
	});
});
