import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { Millisecond } from "../../../../Lib/src/types/TimeTypes";
import { CrowniclesCoreMetrics } from "./CrowniclesCoreMetrics";

export const PERIODIC_LOOPS = {
	ENERGY_REGEN: "energy_regen",
	REPORT_NOTIFICATIONS: "report_notifications",
	DAILY_BONUS_NOTIFICATIONS: "daily_bonus_notifications",
	EXPEDITION_NOTIFICATIONS: "expedition_notifications"
} as const;

export type PeriodicLoopName = typeof PERIODIC_LOOPS[keyof typeof PERIODIC_LOOPS];

export type ResilientLoopOptions = {

	/**
	 * When false, the first iteration runs after `delay` instead of right away
	 */
	startImmediately: boolean;
};

/**
 * Runs `iteration` every `delay`, forever.
 *
 * The rescheduling lives in a `finally` block: a rejected iteration can never kill the loop.
 * Loops that rescheduled themselves as their last statement silently died for good whenever the
 * database was briefly unavailable, leaving game mechanics stopped until the next Core restart.
 */
export function startResilientLoop(
	loop: PeriodicLoopName,
	iteration: () => Promise<void>,
	delay: Millisecond,
	options: ResilientLoopOptions
): void {
	const tick = async (): Promise<void> => {
		try {
			await iteration();
			CrowniclesCoreMetrics.observeLoopRun(loop);
		}
		catch (error) {
			CrowniclesLogger.errorWithObj(`Error in periodic loop ${loop}`, error);
		}
		finally {
			setTimeout(() => {
				tick()
					.then();
			}, delay);
		}
	};

	setTimeout(() => {
		tick()
			.then();
	}, options.startImmediately ? 0 : delay);
}
