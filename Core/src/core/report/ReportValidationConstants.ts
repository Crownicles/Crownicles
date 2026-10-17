/**
 * Constants for report heal validation reasons
 */
export const HEAL_VALIDATION_REASONS = {
	NO_ALTERATION: "no_alteration",
	OCCUPIED: "occupied"
} as const;

export type HealValidationReason = typeof HEAL_VALIDATION_REASONS[keyof typeof HEAL_VALIDATION_REASONS];

/**
 * Constants for report use-tokens validation reasons
 */
export const USE_TOKENS_VALIDATION_REASONS = {
	NOT_ELIGIBLE: "not_eligible",
	INSUFFICIENT_TOKENS: "insufficient_tokens"
} as const;

export type UseTokensValidationReason = typeof USE_TOKENS_VALIDATION_REASONS[keyof typeof USE_TOKENS_VALIDATION_REASONS];
