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

interface YearlySchedule {
	month: number;
	day: number;
	hour: number;
}

/**
 * Set a yearly cron job for a specific date
 * @param toExecute - The function to execute
 * @param shouldRunImmediately - Whether to run immediately if the date has passed this year
 * @param schedule - The schedule containing month (1-12), day (1-31) and hour (0-23)
 */
export async function setYearlyCronJob(
	toExecute: Executable,
	shouldRunImmediately: boolean,
	schedule: YearlySchedule
): Promise<void> {
	// Cron format: minute hour dayOfMonth month *
	await setCronJob(`0 ${schedule.hour} ${schedule.day} ${schedule.month} *`, toExecute, shouldRunImmediately);
}

/**
 * Check if a yearly event should run immediately
 * Used when the bot starts after the scheduled date but hasn't run for this year yet
 * @param schedule - The schedule containing month (1-12), day (1-31) and hour (0-23)
 * @returns True if we're past the scheduled date this year
 */
export function shouldRunYearlyEventImmediately(schedule: YearlySchedule): boolean {
	const now = new Date();
	const scheduledDateThisYear = new Date(now.getFullYear(), schedule.month - 1, schedule.day, schedule.hour, 0, 0);
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
