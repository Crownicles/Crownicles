/**
 * K-factor boost of a ranked fighter whose rating was rarely put at stake recently, so that a stale rating converges
 * faster. With N ranked fights in the window, the countdown is FIGHT_COUNT_THRESHOLD - N: the base K-factor is
 * multiplied by min(countdown - 1, K_FACTOR_MAX_MULTIPLIER) once the countdown reaches COUNTDOWN_THRESHOLD.
 */
export type InactivityKFactorBoost = {
	WINDOW_WEEKS: number;
	FIGHT_COUNT_THRESHOLD: number;
	COUNTDOWN_THRESHOLD: number;
	K_FACTOR_MAX_MULTIPLIER: number;
};
