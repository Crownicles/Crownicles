import { describe, it, expect } from "vitest";
import {getWeekNumber} from "../../src/utils/TimeUtils";

describe("getWeekNumber", () => {
	it("should return 1 for the first week of January", () => {
		const date = new Date("2025-01-02");
		const week = getWeekNumber(date);
		expect(week).toBe(1);
	});

	it("should return increasing week numbers throughout the year", () => {
		const weekStart = getWeekNumber(new Date("2025-01-05"));
		const weekEnd = getWeekNumber(new Date("2025-12-31"));
		expect(weekEnd).toBeGreaterThan(weekStart);
	});

	it("should return same week number for two dates in the same week", () => {
		const monday = new Date("2025-03-03");
		const friday = new Date("2025-03-07");
		expect(getWeekNumber(monday)).toBe(getWeekNumber(friday));
	});

	it("should handle Sundays correctly according to DAYS.JS_SUNDAY_INDEX", () => {
		const sunday = new Date("2025-02-02");
		const monday = new Date("2025-02-03");
		const sundayWeek = getWeekNumber(sunday);
		const mondayWeek = getWeekNumber(monday);

		expect(Math.abs(sundayWeek - mondayWeek)).toBeLessThanOrEqual(1);
	});

	it("should return different week numbers for two dates in different weeks", () => {
		const mondayWeek1 = new Date("2025-03-03");
		const nextMonday = new Date("2025-03-10");

		const week1 = getWeekNumber(mondayWeek1);
		const week2 = getWeekNumber(nextMonday);

		expect(week2).toBeGreaterThan(week1);
		expect(week1).not.toBe(week2);
	});

	it("should not modify the original date object", () => {
		const date = new Date("2025-06-15");
		const originalTime = date.getTime();
		getWeekNumber(date);
		expect(date.getTime()).toBe(originalTime);
	});
});
