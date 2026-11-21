import { afterEach, describe, it, expect, vi } from "vitest";
import {
	asDays, asHours, asMilliseconds, asMinutes, asSeconds, asWeeks,
	dateDisplay, dateToLogs, datesAreOnSameDay, daysToMilliseconds, daysToMinutes, daysToSeconds,
	finishInTimeDisplay, getDateLogs, getDayNumber, getNextWeekDayMidnight, getOneDayAgo, getTimeFromXHoursAgo,
	getTodayMidnight, getTomorrowMidnight, getWeekNumber, hoursToMilliseconds, hoursToMinutes, hoursToSeconds,
	millisecondsToDays, millisecondsToHours, millisecondsToMinutes, millisecondsToSeconds, minutesDisplayIntl,
	minutesToHours, minutesToMilliseconds, printTimeBeforeDate, resetIsNow, sDiff, seasonEndIsNow,
	secondsToMilliseconds, todayIsSunday, weeksToMilliseconds, weeksToSeconds
} from "../../src/utils/TimeUtils";
import { DayOfTheWeek } from "../../src/constants/TimeConstants";
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
		expect(minutesDisplayIntl(60, LANGUAGE.FRENCH)).toBe(`1${nbsp}heure`);
		expect(minutesDisplayIntl(30, LANGUAGE.FRENCH)).toBe("30 minutes");
		expect(minutesDisplayIntl(0, LANGUAGE.FRENCH)).toBe("< 1 minute");
	});

	it("should handle two-part combinations using Intl.DurationFormat", () => {
		// days + hours (no minutes when minutes is 0)
		expect(minutesDisplayIntl(1500, LANGUAGE.FRENCH)).toBe(`1${nbsp}jour et 1${nbsp}heure`); // 24*60 + 60 = 1500
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
		expect(minutesDisplayIntl(1440, LANGUAGE.FRENCH)).toBe(`1${nbsp}jour`); // exactly 24 hours (0 minutes not shown)
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

describe("weeksToSeconds", () => {
	it("should return 604800 seconds for 1 week", () => {
		expect(weeksToSeconds(1)).toBe(604800);
	});

	it("should return 0 for 0 weeks", () => {
		expect(weeksToSeconds(0)).toBe(0);
	});

	it("should scale linearly", () => {
		expect(weeksToSeconds(10)).toBe(10 * 604800);
	});
});

describe("getNextWeekDayMidnight", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	const endOfDay = (year: number, month: number, day: number): number => new Date(year, month, day, 23, 59, 59, 999).valueOf();

	it("returns the end of the next given day later in the week", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2025, 0, 8, 12)); // Wednesday

		expect(getNextWeekDayMidnight(DayOfTheWeek.SATURDAY)).toBe(endOfDay(2025, 0, 11));
		expect(getNextWeekDayMidnight(DayOfTheWeek.SUNDAY)).toBe(endOfDay(2025, 0, 12));
	});

	it("returns the end of today when today is the given day", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2025, 0, 12, 10)); // Sunday

		expect(getNextWeekDayMidnight(DayOfTheWeek.SUNDAY)).toBe(endOfDay(2025, 0, 12));
		expect(getNextWeekDayMidnight(DayOfTheWeek.SATURDAY)).toBe(endOfDay(2025, 0, 18));
	});
});

describe("getNextWeekDayMidnight edge cases", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("still returns the end of today at the very last millisecond of the day", () => {
		vi.useFakeTimers();
		const lastMillisecondOfSunday = new Date(2025, 0, 12, 23, 59, 59, 999);
		vi.setSystemTime(lastMillisecondOfSunday);

		expect(getNextWeekDayMidnight(DayOfTheWeek.SUNDAY)).toBe(lastMillisecondOfSunday.valueOf());
	});

	it("keeps the end of the day when a daylight saving change happens before the reset", () => {
		const previousTimezone = process.env.TZ;
		process.env.TZ = "Europe/Paris";
		try {
			vi.useFakeTimers();
			vi.setSystemTime(new Date(2025, 2, 26, 12)); // Wednesday, the clocks go forward on Sunday the 30th

			const reset = new Date(getNextWeekDayMidnight(DayOfTheWeek.SUNDAY));

			expect([reset.getDate(), reset.getHours(), reset.getMinutes()]).toEqual([30, 23, 59]);
		}
		finally {
			if (previousTimezone === undefined) {
				delete process.env.TZ;
			}
			else {
				process.env.TZ = previousTimezone;
			}
		}
	});
});

describe("time unit conversions", () => {
	it("converts between every unit", () => {
		expect(minutesToMilliseconds(asMinutes(2))).toBe(120_000);
		expect(hoursToMilliseconds(asHours(2))).toBe(7_200_000);
		expect(hoursToMinutes(asHours(2))).toBe(120);
		expect(minutesToHours(asMinutes(90))).toBe(1.5);
		expect(millisecondsToHours(asMilliseconds(5_400_000))).toBe(1.5);
		expect(millisecondsToSeconds(asMilliseconds(1500))).toBe(1.5);
		expect(secondsToMilliseconds(asSeconds(2))).toBe(2000);
		expect(daysToMilliseconds(asDays(2))).toBe(172_800_000);
		expect(weeksToMilliseconds(asWeeks(2))).toBe(1_209_600_000);
		expect(millisecondsToDays(asMilliseconds(129_600_000))).toBe(1.5);
		expect(hoursToSeconds(asHours(2))).toBe(7200);
		expect(daysToMinutes(asDays(2))).toBe(2880);
		expect(daysToSeconds(asDays(2))).toBe(172_800);
	});

	it("counts a started half minute as a whole minute", () => {
		expect(millisecondsToMinutes(asMilliseconds(89_999))).toBe(1);
		expect(millisecondsToMinutes(asMilliseconds(90_000))).toBe(2);
	});

	it("subtracts second timestamps", () => {
		expect(sDiff(asSeconds(100), asSeconds(40))).toBe(60);
	});
});

describe("dates of the current moment", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	const now = new Date(2025, 0, 8, 15, 30, 45, 678); // Wednesday

	function freezeAt(date: Date): void {
		vi.useFakeTimers();
		vi.setSystemTime(date);
	}

	it("truncates the log timestamps to the second", () => {
		freezeAt(now);

		expect(getDateLogs()).toBe(Math.floor(now.valueOf() / 1000));
		expect(dateToLogs(new Date(1_700_000_000_999))).toBe(1_700_000_000);
	});

	it("gives today's and tomorrow's midnight", () => {
		freezeAt(now);

		expect(getTodayMidnight()).toEqual(new Date(2025, 0, 8));
		expect(getTomorrowMidnight()).toEqual(new Date(2025, 0, 9));
	});

	it("numbers the days since the epoch", () => {
		freezeAt(new Date(Date.UTC(1970, 0, 3, 23, 59)));

		expect(getDayNumber()).toBe(2);
	});

	it("gives the timestamp of one day ago", () => {
		freezeAt(now);

		expect(getOneDayAgo()).toBe(now.valueOf() - 86_400_000);
	});

	it("gives the date a given number of hours ago", () => {
		freezeAt(now);

		expect(getTimeFromXHoursAgo(5)).toEqual(new Date(2025, 0, 8, 10, 30, 45, 678));
	});

	it("tells whether today is a sunday", () => {
		freezeAt(now);
		expect(todayIsSunday()).toBe(false);

		freezeAt(new Date(2025, 0, 12, 8));
		expect(todayIsSunday()).toBe(true);
	});

	it("detects the weekly reset during the last five minutes of sunday", () => {
		const endOfSunday = new Date(2025, 0, 12, 23, 59, 59, 999).valueOf();

		freezeAt(new Date(endOfSunday - 5 * 60_000));
		expect(resetIsNow()).toBe(true);

		freezeAt(new Date(endOfSunday - 5 * 60_000 - 1));
		expect(resetIsNow()).toBe(false);
	});

	it("detects the season end during the last twenty minutes of saturday", () => {
		const endOfSaturday = new Date(2025, 0, 11, 23, 59, 59, 999).valueOf();

		freezeAt(new Date(endOfSaturday - 20 * 60_000));
		expect(seasonEndIsNow()).toBe(true);

		freezeAt(new Date(endOfSaturday - 20 * 60_000 - 1));
		expect(seasonEndIsNow()).toBe(false);
	});
});

describe("datesAreOnSameDay", () => {
	it("compares the year, the month and the day", () => {
		const reference = new Date(2025, 4, 10, 1);

		expect(datesAreOnSameDay(reference, new Date(2025, 4, 10, 23))).toBe(true);
		expect(datesAreOnSameDay(reference, new Date(2024, 4, 10, 1))).toBe(false);
		expect(datesAreOnSameDay(reference, new Date(2025, 5, 10, 1))).toBe(false);
		expect(datesAreOnSameDay(reference, new Date(2025, 4, 11, 1))).toBe(false);
	});
});

describe("discord timestamps", () => {
	const date = new Date(1_700_000_000_999);

	it("displays a relative time to the second", () => {
		expect(finishInTimeDisplay(date)).toBe("<t:1700000000:R>");
		expect(printTimeBeforeDate(date.valueOf())).toBe("<t:1700000000:R>");
	});

	it("displays a full date to the second", () => {
		expect(dateDisplay(date)).toBe("<t:1700000000:F>");
	});
});

describe("minutesDisplayIntl without Intl.DurationFormat", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it.each([
		[0, LANGUAGE.FRENCH, "< 1 minute"],
		[1, LANGUAGE.ENGLISH, "1 minute"],
		[2, LANGUAGE.ENGLISH, "2 minutes"],
		[60, LANGUAGE.FRENCH, "1 heure"],
		[120, LANGUAGE.ENGLISH, "2 hours"],
		[1440, LANGUAGE.FRENCH, "1 jour"],
		[2880, LANGUAGE.ENGLISH, "2 days"],
		[125, LANGUAGE.FRENCH, "2 heures et 5 minutes"],
		[1445, LANGUAGE.ENGLISH, "1 day and 5 minutes"],
		[3040, LANGUAGE.FRENCH, "2 jours, 2 heures et 40 minutes"],
		[3040, LANGUAGE.ENGLISH, "2 days, 2 hours and 40 minutes"],
		[125, "fr-CA", "2 heures et 5 minutes"]
	])("formats %i minutes in %s", (minutes, lng, expected) => {
		vi.stubGlobal("Intl", {});

		expect(minutesDisplayIntl(minutes, lng)).toBe(expected);
	});

	it("falls back when the runtime has no Intl at all", () => {
		vi.stubGlobal("Intl", undefined);

		expect(minutesDisplayIntl(125, LANGUAGE.ENGLISH)).toBe("2 hours and 5 minutes");
	});
});
