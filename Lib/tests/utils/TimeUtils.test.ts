import { describe, it, expect } from "vitest";
import {getWeekNumber, minutesDisplay, minutesDisplayI18n, TimeTranslationFunction} from "../../src/utils/TimeUtils";
import {LANGUAGE} from "../../src/Language";

/**
 * Mock translation function for testing minutesDisplayI18n
 * Simulates i18n.t() behavior with French translations
 */
const mockTranslationFr: TimeTranslationFunction = (key: string, options?: { count?: number; lng?: string }): string => {
	const count = options?.count ?? 0;
	const translations: Record<string, string | ((c: number) => string)> = {
		"models:time.day": (c: number) => c === 1 ? `${c} jour` : `${c} jours`,
		"models:time.hour": (c: number) => c === 1 ? `${c} heure` : `${c} heures`,
		"models:time.minute": (c: number) => c === 1 ? `${c} minute` : `${c} minutes`,
		"models:time.second": (c: number) => c === 1 ? `${c} seconde` : `${c} secondes`,
		"models:time.lessThanOneMinute": "< 1 minute",
		"models:time.linkWord": " et ",
		"models:time.separator": ", "
	};
	const translation = translations[key];
	if (typeof translation === "function") {
		return translation(count);
	}
	return translation ?? key;
};

/**
 * Mock translation function for English
 */
const mockTranslationEn: TimeTranslationFunction = (key: string, options?: { count?: number; lng?: string }): string => {
	const count = options?.count ?? 0;
	const translations: Record<string, string | ((c: number) => string)> = {
		"models:time.day": (c: number) => c === 1 ? `${c} day` : `${c} days`,
		"models:time.hour": (c: number) => c === 1 ? `${c} hour` : `${c} hours`,
		"models:time.minute": (c: number) => c === 1 ? `${c} minute` : `${c} minutes`,
		"models:time.second": (c: number) => c === 1 ? `${c} second` : `${c} seconds`,
		"models:time.lessThanOneMinute": "< 1 minute",
		"models:time.linkWord": " and ",
		"models:time.separator": ", "
	};
	const translation = translations[key];
	if (typeof translation === "function") {
		return translation(count);
	}
	return translation ?? key;
};

describe("getWeekNumber", () => {
	it("should return 1 for the first week of January", () => {
		const date = new Date("2025-01-02");
		const week = getWeekNumber(date);
		expect(week).toBe(1);
	});

	it("minutesDisplay should show days/hours/minutes in French", () => {
 		// 3040 minutes = 50 hours 40 minutes = 2 days 2 hours 40 minutes
 		const display = minutesDisplay(3040, LANGUAGE.FRENCH);
 		expect(display).toBe("2 jours, 2 heures et 40 minutes");
 	});

	it("minutesDisplay should show days/hours/minutes in English", () => {
 		const display = minutesDisplay(3040, LANGUAGE.ENGLISH);
 		expect(display).toBe("2 days, 2 hours and 40 minutes");
 	});

	it("minutesDisplay small values", () => {
 		expect(minutesDisplay(60, LANGUAGE.FRENCH)).toBe("1 heure");
 		expect(minutesDisplay(30, LANGUAGE.FRENCH)).toBe("30 minutes");
 		expect(minutesDisplay(0, LANGUAGE.ENGLISH)).toBe("< 1 Min");
 		expect(minutesDisplay(0, LANGUAGE.FRENCH)).toBe("< 1 minute");
 	});

	it("minutesDisplay should handle two-part combinations correctly", () => {
		// days + hours (no minutes)
		expect(minutesDisplay(1500, LANGUAGE.FRENCH)).toBe("1 jour et 1 heure"); // 24*60 + 60 = 1500
		// hours + minutes (no days)
		expect(minutesDisplay(125, LANGUAGE.FRENCH)).toBe("2 heures et 5 minutes");
		// days + minutes (no hours)
		expect(minutesDisplay(1445, LANGUAGE.FRENCH)).toBe("1 jour et 5 minutes"); // 24*60 + 5 = 1445
	});

	it("minutesDisplay should handle edge cases", () => {
		expect(minutesDisplay(1, LANGUAGE.FRENCH)).toBe("1 minute");
		expect(minutesDisplay(61, LANGUAGE.FRENCH)).toBe("1 heure et 1 minute");
		expect(minutesDisplay(1440, LANGUAGE.FRENCH)).toBe("1 jour"); // exactly 24 hours
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

describe("minutesDisplayI18n", () => {
	it("should show days/hours/minutes in French with i18n", () => {
		// 3040 minutes = 50 hours 40 minutes = 2 days 2 hours 40 minutes
		const display = minutesDisplayI18n(3040, mockTranslationFr);
		expect(display).toBe("2 jours, 2 heures et 40 minutes");
	});

	it("should show days/hours/minutes in English with i18n", () => {
		const display = minutesDisplayI18n(3040, mockTranslationEn);
		expect(display).toBe("2 days, 2 hours and 40 minutes");
	});

	it("should handle small values with i18n", () => {
		expect(minutesDisplayI18n(60, mockTranslationFr)).toBe("1 heure");
		expect(minutesDisplayI18n(30, mockTranslationFr)).toBe("30 minutes");
		expect(minutesDisplayI18n(0, mockTranslationFr)).toBe("< 1 minute");
	});

	it("should handle two-part combinations correctly with i18n", () => {
		// days + hours (no minutes)
		expect(minutesDisplayI18n(1500, mockTranslationFr)).toBe("1 jour et 1 heure"); // 24*60 + 60 = 1500
		// hours + minutes (no days)
		expect(minutesDisplayI18n(125, mockTranslationFr)).toBe("2 heures et 5 minutes");
		// days + minutes (no hours)
		expect(minutesDisplayI18n(1445, mockTranslationFr)).toBe("1 jour et 5 minutes"); // 24*60 + 5 = 1445
	});

	it("should handle edge cases with i18n", () => {
		expect(minutesDisplayI18n(1, mockTranslationFr)).toBe("1 minute");
		expect(minutesDisplayI18n(61, mockTranslationFr)).toBe("1 heure et 1 minute");
		expect(minutesDisplayI18n(1440, mockTranslationFr)).toBe("1 jour"); // exactly 24 hours
	});

	it("should produce same results as minutesDisplay for French", () => {
		const testCases = [0, 1, 30, 60, 61, 125, 1440, 1445, 1500, 3040];
		for (const minutes of testCases) {
			const oldResult = minutesDisplay(minutes, LANGUAGE.FRENCH);
			const newResult = minutesDisplayI18n(minutes, mockTranslationFr);
			expect(newResult).toBe(oldResult);
		}
	});

	it("should produce same results as minutesDisplay for English", () => {
		// Note: The i18n version uses "< 1 minute" instead of "< 1 Min" for consistency
		// This is an intentional improvement over the legacy function
		const testCases = [1, 30, 60, 61, 125, 1440, 1445, 1500, 3040]; // Exclude 0 (different format)
		for (const minutes of testCases) {
			const oldResult = minutesDisplay(minutes, LANGUAGE.ENGLISH);
			const newResult = minutesDisplayI18n(minutes, mockTranslationEn);
			expect(newResult).toBe(oldResult);
		}
		// Special case: 0 minutes has different format (improved in i18n version)
		expect(minutesDisplayI18n(0, mockTranslationEn)).toBe("< 1 minute");
	});
});
