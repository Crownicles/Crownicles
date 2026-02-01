/**
 * Constants for report heal validation reasons
 */
export const HEAL_VALIDATION_REASONS = {
	NO_ALTERATION: "no_alteration",
	OCCUPIED: "occupied"
} as const;

export type HealValidationReason = typeof HEAL_VALIDATION_REASONS[keyof typeof HEAL_VALIDATION_REASONS];
