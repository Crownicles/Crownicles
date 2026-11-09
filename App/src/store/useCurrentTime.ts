import {
	useLayoutEffect, useState
} from "react";

/** How often a clock reads the time: a countdown in seconds, or a wait worded in minutes. */
export const CLOCK_INTERVALS = {
	SECOND_MS: 1_000, MINUTE_MS: 60_000
} as const;

/**
 * The current time, refreshed every `intervalMs` while `active`; 0 until the first tick so the first render stays pure.
 * The first tick lands before paint, so a freshly mounted countdown never shows that 0.
 */
export function useCurrentTime(intervalMs: number, active = true): number {
	const [currentTime, setCurrentTime] = useState(0);

	useLayoutEffect((): (() => void) | undefined => {
		if (!active) {
			return undefined;
		}
		const updateCurrentTime = (): void => setCurrentTime(Date.now());
		updateCurrentTime();
		const intervalId = setInterval(updateCurrentTime, intervalMs);
		return (): void => clearInterval(intervalId);
	}, [active, intervalMs]);

	return currentTime;
}
