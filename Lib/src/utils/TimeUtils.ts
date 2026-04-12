import {
	DAYS,
	TimeConstants
} from "../constants/TimeConstants";
import {
	asMilliseconds, dateToMs, Millisecond, msDiff, nowMs, Second
} from "../types/TimeTypes";

export {
	asMilliseconds, asSeconds, dateToMs, msDiff, nowMs
} from "../types/TimeTypes";
export type {
	Millisecond, Second
} from "../types/TimeTypes";

/**
 * Get the current date for logging purposes
 */
export function getDateLogs(): number {
	return Math.trunc(Date.now() / TimeConstants.MS_TIME.SECOND);
}

/**
 * Convert a date to a timestamp for logging purposes
 * @param date
 */
export function dateToLogs(date: Date): number {
	return Math.trunc(date.valueOf() / TimeConstants.MS_TIME.SECOND);
}

/**
 * Get a date value of tomorrow
 */
export function getTomorrowMidnight(): Date {
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	tomorrow.setHours(0, 0, 0, 0);
	return tomorrow;
}

/**
 * Get a date value of today at midnight
 */
export function getTodayMidnight(): Date {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return today;
}

/**
 * Get the day number
 */
export function getDayNumber(): number {
	return Math.floor(new Date().valueOf() / TimeConstants.MS_TIME.DAY);
}

/**
 * Convert milliseconds to minutes
 * @param milliseconds
 */
export function millisecondsToMinutes(milliseconds: Millisecond): number {
	return Math.round(milliseconds / TimeConstants.MS_TIME.MINUTE);
}

/**
 * Convert minutes to seconds
 * @param minutes
 */
export function minutesToMilliseconds(minutes: number): Millisecond {
	return minutes * TimeConstants.MS_TIME.MINUTE as Millisecond;
}

/**
 * Convert hours to milliseconds
 * @param hours
 */
export function hoursToMilliseconds(hours: number): Millisecond {
	return hours * TimeConstants.MS_TIME.HOUR as Millisecond;
}

/**
 * Convert hours to minutes
 * @param hours
 */
export function hoursToMinutes(hours: number): number {
	return hours * TimeConstants.S_TIME.MINUTE;
}

/**
 * Convert minutes to hours
 * @param minutes
 */
export function minutesToHours(minutes: number): number {
	return minutes / TimeConstants.S_TIME.MINUTE;
}

/**
 * Convert minutes to hours
 * @param milliseconds
 */
export function millisecondsToHours(milliseconds: Millisecond): number {
	return milliseconds / TimeConstants.MS_TIME.HOUR;
}

/**
 * Convert milliseconds to seconds
 * @param milliseconds
 */
export function millisecondsToSeconds(milliseconds: Millisecond): Second {
	return milliseconds / TimeConstants.MS_TIME.SECOND as Second;
}

/**
 * Convert seconds to milliseconds
 * @param seconds
 */
export function secondsToMilliseconds(seconds: Second): Millisecond {
	return seconds * TimeConstants.MS_TIME.SECOND as Millisecond;
}

/**
 * Convert days to milliseconds
 * @param days
 */
export function daysToMilliseconds(days: number): Millisecond {
	return days * TimeConstants.HOURS_IN_DAY * TimeConstants.MS_TIME.HOUR as Millisecond;
}

/**
 * Convert milliseconds to days
 * @param milliseconds
 */
export function millisecondsToDays(milliseconds: Millisecond): number {
	return milliseconds / (TimeConstants.HOURS_IN_DAY * TimeConstants.MS_TIME.HOUR);
}

/**
 * Convert hours to seconds
 * @param hours
 */
export function hoursToSeconds(hours: number): Second {
	return hours * TimeConstants.S_TIME.HOUR as Second;
}

/**
 * Convert days to minutes
 * @param days
 */
export function daysToMinutes(days: number): number {
	return days * TimeConstants.HOURS_IN_DAY * TimeConstants.S_TIME.MINUTE;
}

/**
 * Convert days to seconds
 * @param days
 */
export function daysToSeconds(days: number): Second {
	return days * TimeConstants.S_TIME.DAY as Second;
}

/**
 * Check if two dates are the same day
 * @param first - first date
 * @param second - second date
 */
export function datesAreOnSameDay(first: Date, second: Date): boolean {
	return first.getFullYear() === second.getFullYear()
		&& first.getMonth() === second.getMonth()
		&& first.getDate() === second.getDate();
}

/**
 * Display the time before given date in a human-readable format
 * @param finishDate - the date to use
 */
export function finishInTimeDisplay(finishDate: Date): string {
	return `<t:${Math.floor(millisecondsToSeconds(dateToMs(finishDate)))
		.toString()}:R>`;
}

/**
 * Display the time before given date in a human-readable format
 * @param finishDate - the date to use
 */
export function dateDisplay(finishDate: Date): string {
	return `<t:${Math.floor(millisecondsToSeconds(dateToMs(finishDate)))
		.toString()}:F>`;
}

/**
 * Get the next week's start
 */
export function getNextSundayMidnight(): Millisecond {
	const now = new Date();
	const dateOfReset = new Date();
	dateOfReset.setDate(now.getDate() + (7 - now.getDay()) % 7);
	dateOfReset.setHours(23, 59, 59, 999);
	let dateOfResetTimestamp = dateOfReset.valueOf();
	while (dateOfResetTimestamp < now.valueOf()) {
		dateOfResetTimestamp += hoursToMilliseconds(24 * 7);
	}
	return asMilliseconds(dateOfResetTimestamp);
}

/**
 * Get the date from one day ago as a timestamp
 */
export function getOneDayAgo(): Millisecond {
	return msDiff(nowMs(), TimeConstants.MS_TIME.DAY);
}

/**
 * Returns true if we are currently on a sunday
 */
export function todayIsSunday(): boolean {
	const now = new Date();
	return now.getDay() === DAYS.JS_SUNDAY_INDEX;
}

/**
 * Get the next season's start
 */
export function getNextSaturdayMidnight(): Millisecond {
	const now = new Date();
	const dateOfReset = new Date();
	dateOfReset.setDate(now.getDate() + (6 - now.getDay()) % 7);
	dateOfReset.setHours(23, 59, 59, 999);
	let dateOfResetTimestamp = dateOfReset.valueOf();
	while (dateOfResetTimestamp < now.valueOf()) {
		dateOfResetTimestamp += TimeConstants.MS_TIME.DAY * TimeConstants.DAYS_IN_WEEK;
	}
	return asMilliseconds(dateOfResetTimestamp);
}

/**
 * Check if the reset is being done currently
 */
export function resetIsNow(): boolean {
	return getNextSundayMidnight() - Date.now() <= minutesToMilliseconds(5);
}

/**
 * Check if the reset of the season end is being done currently
 */
export function seasonEndIsNow(): boolean {
	return getNextSaturdayMidnight() - Date.now() <= minutesToMilliseconds(20);
}

/**
 * Parse the time remaining before a date.
 * @param date
 */
export function printTimeBeforeDate(date: number): string {
	date /= TimeConstants.MS_TIME.SECOND;
	return `<t:${Math.floor(date)
		.valueOf()
		.toString()}:R>`;
}

/**
 * Get the date of now minus the given number of hours
 * @param hours - the number of hours to remove
 */
export function getTimeFromXHoursAgo(hours: number): Date {
	const time = new Date();
	time.setHours(time.getHours() - hours);
	return time;
}

/**
 * Fallback duration formatting for runtimes without Intl.DurationFormat
 */
function minutesDisplayFallback(minutes: number, lng: string): string {
	let hours = Math.floor(minutesToHours(minutes));
	const mins = Math.floor(minutes % TimeConstants.S_TIME.MINUTE);
	const days = Math.floor(hours / TimeConstants.HOURS_IN_DAY);
	hours %= TimeConstants.HOURS_IN_DAY;

	const isFrench = lng.startsWith("fr");
	const pluralSuffix = (n: number): string => n > 1 ? "s" : "";

	const parts: string[] = [];
	if (days > 0) {
		parts.push(`${days} ${isFrench ? "jour" : "day"}${pluralSuffix(days)}`);
	}
	if (hours > 0) {
		parts.push(`${hours} ${isFrench ? "heure" : "hour"}${pluralSuffix(hours)}`);
	}
	if (mins > 0) {
		parts.push(`${mins} minute${pluralSuffix(mins)}`);
	}

	if (parts.length === 0) {
		return "< 1 minute";
	}

	if (parts.length === 1) {
		return parts[0];
	}

	const linkWord = isFrench ? " et " : " and ";
	const lastPart = parts.pop()!;
	return `${parts.join(", ")}${linkWord}${lastPart}`;
}

/**
 * Display a time in a human-readable format using Intl.DurationFormat
 * @param minutes - the time in minutes
 * @param lng - language code for formatting
 */
export function minutesDisplayIntl(minutes: number, lng: string): string {
	// Fallback for runtimes without Intl.DurationFormat (Node < 24)
	if (typeof Intl === "undefined" || !("DurationFormat" in Intl)) {
		return minutesDisplayFallback(minutes, lng);
	}

	// Compute components
	let hours = Math.floor(minutesToHours(minutes));
	const mins = Math.floor(minutes % TimeConstants.S_TIME.MINUTE);
	const days = Math.floor(hours / TimeConstants.HOURS_IN_DAY);
	hours %= TimeConstants.HOURS_IN_DAY;

	// Build duration object with only non-zero values
	const duration: Intl.DurationInput = {};
	if (days > 0) {
		duration.days = days;
	}
	if (hours > 0) {
		duration.hours = hours;
	}
	if (mins > 0) {
		duration.minutes = mins;
	}

	// If all values are 0, show "< 1 minute" using Intl formatting for localized output
	if (Object.keys(duration).length === 0) {
		const formatter = new Intl.DurationFormat(lng, {
			style: "long",
			minutesDisplay: "always"
		});
		return `< ${formatter.format({ minutes: 1 })}`;
	}

	const formatter = new Intl.DurationFormat(lng, {
		style: "long"
	});
	return formatter.format(duration);
}

/**
 * Get the iso week number of the year of the given date
 * @param date
 */
export function getWeekNumber(date: Date): number {
	const dateCopied = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const dayNum = dateCopied.getDay() === DAYS.JS_SUNDAY_INDEX ? DAYS.SUNDAY : dateCopied.getDay();
	dateCopied.setDate(dateCopied.getDate() + DAYS.THURSDAY - dayNum);
	const isoYear = dateCopied.getFullYear();
	const yearStart = new Date(isoYear, 0, 1);
	const diffDays = Math.floor((dateCopied.getTime() - yearStart.getTime()) / TimeConstants.MS_TIME.DAY);
	return Math.ceil((diffDays + 1) / 7);
}

