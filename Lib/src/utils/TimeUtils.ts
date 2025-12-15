import {
	Language,
	LANGUAGE
} from "../Language";
import {
	DAYS,
	TimeConstants
} from "../constants/TimeConstants";

/**
 * Translation function type for time display
 * Compatible with i18n.t() signature - uses a generic type to allow any compatible function
 */
export type TimeTranslationFunction = (key: string, options?: Record<string, unknown>) => string;

/**
 * Get the elements to display the remaining time in the given language
 * @deprecated Use minutesDisplayI18n instead for proper i18n support
 * @param language
 */
function getMinutesDisplayStringConstants(language: string): {
	daysDisplay: string;
	hoursDisplay: string;
	minutesDisplay: string;
	secondsDisplay: string;
	lessThanOneMinute: string;
	plural: string;
	linkWord: string;
} {
	return language === ""
		? {
			daysDisplay: "D",
			hoursDisplay: "H",
			minutesDisplay: "Min",
			secondsDisplay: "s",
			lessThanOneMinute: "< 1 Min",
			linkWord: " ",
			plural: ""
		}
		: language === LANGUAGE.FRENCH
			? {
				daysDisplay: "jour",
				hoursDisplay: "heure",
				minutesDisplay: "minute",
				secondsDisplay: "seconde",
				lessThanOneMinute: "< 1 minute",
				linkWord: " et ",
				plural: "s"
			}
			: {
				daysDisplay: "day",
				hoursDisplay: "hour",
				minutesDisplay: "minute",
				secondsDisplay: "second",
				lessThanOneMinute: "< 1 Min",
				linkWord: " and ",
				plural: "s"
			};
}

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
export function millisecondsToMinutes(milliseconds: number): number {
	return Math.round(milliseconds / TimeConstants.MS_TIME.MINUTE);
}

/**
 * Convert minutes to seconds
 * @param minutes
 */
export function minutesToMilliseconds(minutes: number): number {
	return minutes * TimeConstants.MS_TIME.MINUTE;
}

/**
 * Convert hours to milliseconds
 * @param hours
 */
export function hoursToMilliseconds(hours: number): number {
	return hours * TimeConstants.MS_TIME.HOUR;
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
export function millisecondsToHours(milliseconds: number): number {
	return milliseconds / TimeConstants.MS_TIME.HOUR;
}

/**
 * Convert milliseconds to seconds
 * @param milliseconds
 */
export function millisecondsToSeconds(milliseconds: number): number {
	return milliseconds / TimeConstants.MS_TIME.SECOND;
}

/**
 * Convert seconds to milliseconds
 * @param seconds
 */
export function secondsToMilliseconds(seconds: number): number {
	return seconds * TimeConstants.MS_TIME.SECOND;
}

/**
 * Convert days to milliseconds
 * @param days
 */
export function daysToMilliseconds(days: number): number {
	return days * TimeConstants.HOURS_IN_DAY * TimeConstants.MS_TIME.HOUR;
}

/**
 * Convert hours to seconds
 * @param hours
 */
export function hoursToSeconds(hours: number): number {
	return hours * TimeConstants.S_TIME.HOUR;
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
export function daysToSeconds(days: number): number {
	return days * TimeConstants.S_TIME.DAY;
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
	return `<t:${Math.floor(millisecondsToSeconds(finishDate.valueOf()))
		.toString()}:R>`;
}

/**
 * Display the time before given date in a human-readable format
 * @param finishDate - the date to use
 */
export function dateDisplay(finishDate: Date): string {
	return `<t:${Math.floor(millisecondsToSeconds(finishDate.valueOf()))
		.toString()}:F>`;
}

/**
 * Get the next week's start
 */
export function getNextSundayMidnight(): number {
	const now = new Date();
	const dateOfReset = new Date();
	dateOfReset.setDate(now.getDate() + (7 - now.getDay()) % 7);
	dateOfReset.setHours(23, 59, 59, 999);
	let dateOfResetTimestamp = dateOfReset.valueOf();
	while (dateOfResetTimestamp < now.valueOf()) {
		dateOfResetTimestamp += hoursToMilliseconds(24 * 7);
	}
	return dateOfResetTimestamp;
}

/**
 * Get the date from one day ago as a timestamp
 */
export function getOneDayAgo(): number {
	return Date.now() - TimeConstants.MS_TIME.DAY;
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
export function getNextSaturdayMidnight(): number {
	const now = new Date();
	const dateOfReset = new Date();
	dateOfReset.setDate(now.getDate() + (6 - now.getDay()) % 7);
	dateOfReset.setHours(23, 59, 59, 999);
	let dateOfResetTimestamp = dateOfReset.valueOf();
	while (dateOfResetTimestamp < now.valueOf()) {
		dateOfResetTimestamp += TimeConstants.MS_TIME.DAY * TimeConstants.DAYS_IN_WEEK;
	}
	return dateOfResetTimestamp;
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
 * Display a time in a human-readable format
 * @deprecated Use minutesDisplayI18n instead for proper i18n support
 * @param minutes - the time in minutes
 * @param language
 */
export function minutesDisplay(minutes: number, language: Language = LANGUAGE.DEFAULT_LANGUAGE): string {
	// Compute components
	let hours = Math.floor(minutesToHours(minutes));
	minutes = Math.floor(minutes % TimeConstants.S_TIME.MINUTE);
	const days = Math.floor(hours / TimeConstants.HOURS_IN_DAY);
	hours %= TimeConstants.HOURS_IN_DAY;

	const displayConstantValues = getMinutesDisplayStringConstants(language);

	const parts = [
		days > 0 ? `${days} ${displayConstantValues.daysDisplay}${days > 1 ? displayConstantValues.plural : ""}` : "",
		hours > 0 ? `${hours} ${displayConstantValues.hoursDisplay}${hours > 1 ? displayConstantValues.plural : ""}` : "",
		minutes > 0 ? `${minutes} ${displayConstantValues.minutesDisplay}${minutes > 1 ? displayConstantValues.plural : ""}` : ""
	].filter(v => v !== "");

	if (parts.length === 0) {
		return displayConstantValues.lessThanOneMinute;
	}

	if (parts.length === 1) {
		return parts[0];
	}

	// Join all parts except the last with commas, then add the link word before the last part
	const lastPart = parts.pop()!;
	return `${parts.join(", ")}${displayConstantValues.linkWord}${lastPart}`;
}

/**
 * Display a time in a human-readable format using i18n translations
 * @param minutes - the time in minutes
 * @param t - translation function (i18n.t)
 * @param lng - language code (optional, passed to translation function)
 */
export function minutesDisplayI18n(minutes: number, t: TimeTranslationFunction, lng?: string): string {
	// Compute components
	let hours = Math.floor(minutesToHours(minutes));
	minutes = Math.floor(minutes % TimeConstants.S_TIME.MINUTE);
	const days = Math.floor(hours / TimeConstants.HOURS_IN_DAY);
	hours %= TimeConstants.HOURS_IN_DAY;

	const parts: string[] = [];

	if (days > 0) {
		parts.push(t("models:time.day", { count: days, lng }));
	}
	if (hours > 0) {
		parts.push(t("models:time.hour", { count: hours, lng }));
	}
	if (minutes > 0) {
		parts.push(t("models:time.minute", { count: minutes, lng }));
	}

	if (parts.length === 0) {
		return t("models:time.lessThanOneMinute", { lng });
	}

	if (parts.length === 1) {
		return parts[0];
	}

	// Join all parts except the last with separator, then add the link word before the last part
	const lastPart = parts.pop()!;
	const separator = t("models:time.separator", { lng });
	const linkWord = t("models:time.linkWord", { lng });
	return `${parts.join(separator)}${linkWord}${lastPart}`;
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

