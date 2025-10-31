import {
	Language,
	LANGUAGE
} from "../Language";
import { TimeConstants } from "../constants/TimeConstants";

/**
 * Get the elements to display the remaining time in the given language
 * @param language
 */
function getMinutesDisplayStringConstants(language: string): {
	hoursDisplay: string;
	minutesDisplay: string;
	secondsDisplay: string;
	plural: string;
	linkWord: string;
} {
	return language === ""
		? {
			hoursDisplay: "H",
			minutesDisplay: "Min",
			secondsDisplay: "s",
			linkWord: " ",
			plural: ""
		}
		: language === LANGUAGE.FRENCH
			? {
				hoursDisplay: "heure",
				minutesDisplay: "minute",
				secondsDisplay: "seconde",
				linkWord: " et ",
				plural: "s"
			}
			: {
				hoursDisplay: "hour",
				minutesDisplay: "minute",
				secondsDisplay: "second",
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
	return now.getDay() === 0;
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
 * @param minutes - the time in minutes
 * @param language
 */
export function minutesDisplay(minutes: number, language: Language = LANGUAGE.DEFAULT_LANGUAGE): string {
	const hours = Math.floor(minutesToHours(minutes));
	minutes = Math.floor(minutes % TimeConstants.S_TIME.MINUTE);
	const displayConstantValues = getMinutesDisplayStringConstants(language);
	const display = [
		hours > 0 ? `${hours} ${displayConstantValues.hoursDisplay}${hours > 1 ? displayConstantValues.plural : ""}` : "",
		minutes > 0 ? `${minutes} ${displayConstantValues.minutesDisplay}${minutes > 1 ? displayConstantValues.plural : ""}` : ""
	].filter(v => v !== "")
		.join(displayConstantValues.linkWord);
	return display === "" ? "< 1 Min" : display;
}

/**
 * Get the week number of the year of the given date
 * @param date
 */
export function getWeekNumber(date: Date): number {
	const dateCopied = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const dayNum = dateCopied.getUTCDay() || 7;
	dateCopied.setUTCDate(dateCopied.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(dateCopied.getUTCFullYear(), 0, 1));
	return Math.ceil(((dateCopied.getTime() - yearStart.getTime()) / TimeConstants.MS_TIME.DAY + 1) / 7);
}
