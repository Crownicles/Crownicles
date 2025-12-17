import { describe, it, expect } from "vitest";
import {getWeekNumber, minutesDisplayIntl} from "../../src/utils/TimeUtils";
import {LANGUAGE} from "../../src/Language";





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


describe("minutesDisplayIntl", () => {
	// Note: French uses non-breaking space (\u00A0) between number and unit for first units
	// but minutes at the end use regular space. This is Intl.DurationFormat's native behavior.
	const nbsp = "\u00A0";

	it("should show days/hours/minutes in French using Intl.DurationFormat", () => {
		// 3040 minutes = 50 hours 40 minutes = 2 days 2 hours 40 minutes
		const display = minutesDisplayIntl(3040, LANGUAGE.FRENCH);
		expect(display).toBe(`2${nbsp}jours, 2${nbsp}heures et 40 minutes`);
	});

	it("should show days/hours/minutes in English using Intl.DurationFormat", () => {
		const display = minutesDisplayIntl(3040, LANGUAGE.ENGLISH);
		expect(display).toBe("2 days, 2 hours, 40 minutes");
	});

	it("should handle small values using Intl.DurationFormat", () => {
		expect(minutesDisplayIntl(60, LANGUAGE.FRENCH)).toBe(`1${nbsp}heure et 0 minute`);
		expect(minutesDisplayIntl(30, LANGUAGE.FRENCH)).toBe("30 minutes");
		expect(minutesDisplayIntl(0, LANGUAGE.FRENCH)).toBe("0 minute");
	});

	it("should handle two-part combinations using Intl.DurationFormat", () => {
		// days + hours (no minutes but minutesDisplay: always shows 0)
		expect(minutesDisplayIntl(1500, LANGUAGE.FRENCH)).toBe(`1${nbsp}jour, 1${nbsp}heure et 0 minute`); // 24*60 + 60 = 1500
		// hours + minutes (no days)
		expect(minutesDisplayIntl(125, LANGUAGE.FRENCH)).toBe(`2${nbsp}heures et 5 minutes`);
		// days + minutes (no hours)
		expect(minutesDisplayIntl(1445, LANGUAGE.FRENCH)).toBe(`1${nbsp}jour et 5 minutes`); // 24*60 + 5 = 1445
	});

	it("should handle edge cases using Intl.DurationFormat", () => {
		// Single unit uses regular space
		expect(minutesDisplayIntl(1, LANGUAGE.FRENCH)).toBe("1 minute");
		// Multiple units: first units use nbsp, last (minutes) uses regular space
		expect(minutesDisplayIntl(61, LANGUAGE.FRENCH)).toBe(`1${nbsp}heure et 1 minute`);
		expect(minutesDisplayIntl(1440, LANGUAGE.FRENCH)).toBe(`1${nbsp}jour et 0 minute`); // exactly 24 hours
	});

	it("should work with different locales", () => {
		// German - uses commas, not "und"
		expect(minutesDisplayIntl(125, "de")).toBe("2 Stunden, 5 Minuten");
		// Spanish
		expect(minutesDisplayIntl(125, "es")).toBe("2 horas y 5 minutos");
		// Italian
		expect(minutesDisplayIntl(125, "it")).toBe("2 ore e 5 minuti");
	});
});