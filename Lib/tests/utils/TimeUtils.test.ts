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
		const weekEnd = getWeekNumber(new Date("2025-12-01"));
		expect(weekEnd).toBeGreaterThan(weekStart);
	});

	it("should show that some dates in the same ISO week can have the same week number", () => {
		const weekStart = getWeekNumber(new Date("2025-01-05")); // first week of 2025
		const weekEnd = getWeekNumber(new Date("2025-12-31"));   // first week of 2026
		expect(weekEnd).toBe(weekStart);
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

		expect(Math.abs(sundayWeek - mondayWeek)).toBe(1);
	});

	it("should return different week numbers for two dates in different weeks", () => {
		const mondayWeek1 = new Date("2025-03-03");
		const nextMonday = new Date("2025-03-10");

		const week1 = getWeekNumber(mondayWeek1);
		const week2 = getWeekNumber(nextMonday);

		expect(week2).toBe(week1 + 1);
		expect(week1).not.toBe(week2);
	});

	it("should not modify the original date object", () => {
		const date = new Date("2025-06-15");
		const originalTime = date.getTime();
		getWeekNumber(date);
		expect(date.getTime()).toBe(originalTime);
	});

	it("should give the same week number for all days in the same week (random date)", () => {
		const randomYear = 2025;
		const randomDayOfYear = Math.floor(Math.random() * 365);
		const randomDate = new Date(randomYear, 0, 1 + randomDayOfYear);

		const day = randomDate.getDay() || 7;
		const monday = new Date(randomDate);
		monday.setDate(randomDate.getDate() - day + 1);

		const daysOfWeek = Array.from({length: 7}, (_, i) => {
			const d = new Date(monday);
			d.setDate(monday.getDate() + i);
			return d;
		});
		const weekNumbers = daysOfWeek.map((d) => getWeekNumber(d));

		// Vérifie que tous les jours ont le même numéro
		const uniqueWeeks = new Set(weekNumbers);
		expect(uniqueWeeks.size).toBe(1);

	});
});
