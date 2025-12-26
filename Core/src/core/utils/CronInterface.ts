import { CronJob } from "cron";

export enum DayOfTheWeek {
	SUNDAY = "0",
	MONDAY = "1",
	TUESDAY = "2",
	WEDNESDAY = "3",
	THURSDAY = "4",
	FRIDAY = "5",
	SATURDAY = "6"
}

type Executable = () => Promise<void> | void;

export async function setDailyCronJob(
	toExecute: Executable,
	shouldRunImmediately: boolean
): Promise<void> {
	await setCronJob("0 0 * * *", toExecute, shouldRunImmediately);
}

export async function setWeeklyCronJob(
	toExecute: Executable,
	shouldRunImmediately: boolean,
	dayOfTheWeek: DayOfTheWeek
): Promise<void> {
	await setCronJob(`0 0 * * ${dayOfTheWeek}`, toExecute, shouldRunImmediately);
}

/**
 * Set a yearly cron job for a specific date
 * @param toExecute - The function to execute
 * @param shouldRunImmediately - Whether to run immediately if the date has passed this year
 * @param month - Month (1-12)
 * @param day - Day of month (1-31)
 * @param hour - Hour (0-23)
 */
export async function setYearlyCronJob(
	toExecute: Executable,
	shouldRunImmediately: boolean,
	month: number,
	day: number,
	hour: number
): Promise<void> {
	// Cron format: minute hour dayOfMonth month *
	await setCronJob(`0 ${hour} ${day} ${month} *`, toExecute, shouldRunImmediately);
}

/**
 * Check if a yearly event should run immediately
 * Used when the bot starts after the scheduled date but hasn't run for this year yet
 * @param month - Month (1-12)
 * @param day - Day of month (1-31)
 * @param hour - Hour (0-23)
 * @returns True if we're past the scheduled date this year
 */
export function shouldRunYearlyEventImmediately(month: number, day: number, hour: number): boolean {
	const now = new Date();
	const scheduledDateThisYear = new Date(now.getFullYear(), month - 1, day, hour, 0, 0);
	return now >= scheduledDateThisYear;
}

async function setCronJob(
	cronTime: string,
	toExecute: Executable,
	shouldRunImmediately: boolean
): Promise<void> {
	if (shouldRunImmediately) {
		await toExecute();
	}
	CronJob.from({
		cronTime,
		onTick: toExecute,
		start: true
	});
}
