import {useEffect, useState} from "react";

/** The current time, refreshed every `intervalMs`; 0 until the first tick so the first render stays pure. */
export function useCurrentTime(intervalMs: number): number {
	const [currentTime, setCurrentTime] = useState(0);

	useEffect((): (() => void) => {
		const updateCurrentTime = (): void => setCurrentTime(Date.now());
		updateCurrentTime();
		const intervalId = setInterval(updateCurrentTime, intervalMs);
		return (): void => clearInterval(intervalId);
	}, [intervalMs]);

	return currentTime;
}
