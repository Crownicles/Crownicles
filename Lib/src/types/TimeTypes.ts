/**
 * Branded type for values representing seconds.
 * Use `asSeconds()` to create from a raw number.
 */
export type Second = number & { readonly __brand: "Second" };

/**
 * Branded type for values representing milliseconds.
 * Use `asMilliseconds()` to create from a raw number.
 */
export type Millisecond = number & { readonly __brand: "Millisecond" };

/**
 * Cast a raw number as a Second value
 */
export function asSeconds(n: number): Second {
	return n as Second;
}

/**
 * Cast a raw number as a Millisecond value
 */
export function asMilliseconds(n: number): Millisecond {
	return n as Millisecond;
}

/**
 * Convert a Second value to Millisecond
 */
export function secondsToMs(s: Second): Millisecond {
	return (s * 1000) as Millisecond;
}

/**
 * Convert a Millisecond value to Second
 */
export function msToSeconds(ms: Millisecond): Second {
	return (ms / 1000) as Second;
}
