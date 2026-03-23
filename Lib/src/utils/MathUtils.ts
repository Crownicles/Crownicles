/**
 * Returns the fractional part of a number, always in [0, 1).
 * For negative numbers, returns the absolute value of the fractional part.
 */
export function frac(x: number): number {
	return x >= 0 ? x % 1 : -(x % 1);
}
