/**
 * Readable reason of a caught value, which may not be an Error
 */
export function getErrorReason(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
