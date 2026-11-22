/**
 * Inclusive bounds, each one optional
 */
export type OutcomeRange = {
	min?: number;
	max?: number;
};

/**
 * Check if a value falls within the specified range requirements
 */
export function isRangeValid(range: OutcomeRange | undefined, value: number): boolean {
	if (!range) {
		return true;
	}

	if (range.min !== undefined && value < range.min) {
		return false;
	}

	return !(range.max !== undefined && value > range.max);
}
