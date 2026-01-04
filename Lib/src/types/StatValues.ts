export type StatValues = {
	attack: number; defense: number; speed: number;
};

/**
 * Default stat values that represent "no comparison" - uses Infinity so any item value appears normal
 */
export const NO_STAT_COMPARISON: StatValues = {
	attack: Infinity,
	defense: Infinity,
	speed: Infinity
};
