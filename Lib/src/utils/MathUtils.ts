/**
 * Returns the fractional part of a number, always in [0, 1).
 * For negative numbers, returns the absolute value of the fractional part.
 */
export function frac(x: number): number {
	return x >= 0 ? x % 1 : -(x % 1);
}

/**
 * Returns the median of a non-empty list of numbers, the mean of the two middle values for an even count
 */
export function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}
