/**
 * Branded type for values representing minutes.
 * Use `asMinutes()` to create from a raw number.
 */
export type Minute = number & { readonly __brand: "Minute" };

/**
 * Branded type for values representing hours.
 * Use `asHours()` to create from a raw number.
 */
export type Hour = number & { readonly __brand: "Hour" };

/**
 * Branded type for values representing days.
 * Use `asDays()` to create from a raw number.
 */
export type Day = number & { readonly __brand: "Day" };

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
 * Cast a raw number as a Minute value
 */
export function asMinutes(n: number): Minute {
	return n as Minute;
}

/**
 * Cast a raw number as an Hour value
 */
export function asHours(n: number): Hour {
	return n as Hour;
}

/**
 * Cast a raw number as a Day value
 */
export function asDays(n: number): Day {
	return n as Day;
}

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
 * Convert a Date to a Millisecond timestamp
 */
export function dateToMs(date: Date): Millisecond {
	return date.valueOf() as Millisecond;
}

/**
 * Get the current time as a Millisecond timestamp
 */
export function nowMs(): Millisecond {
	return Date.now() as Millisecond;
}

/**
 * Compute the difference between two Millisecond timestamps
 */
export function msDiff(a: Millisecond, b: Millisecond): Millisecond {
	return (a - b) as Millisecond;
}
