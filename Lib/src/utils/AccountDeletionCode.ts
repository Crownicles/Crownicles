import {
	createHmac, timingSafeEqual
} from "crypto";

/**
 * Length of a deletion code, in hexadecimal characters
 */
export const ACCOUNT_DELETION_CODE_LENGTH = 16;

/**
 * Generate the deletion code of an account.
 *
 * The code is derived from the account id, so it never has to be stored: any service holding the
 * same secret recomputes it. Discord and the REST API therefore agree without sharing state.
 * @param keycloakId
 * @param secret
 */
export function generateDeletionCode(keycloakId: string, secret: string): string {
	return createHmac("sha256", secret)
		.update(keycloakId)
		.digest("hex")
		.substring(0, ACCOUNT_DELETION_CODE_LENGTH)
		.toUpperCase();
}

/**
 * Check a deletion code against the one expected for an account.
 * @param keycloakId
 * @param code
 * @param secret
 */
export function verifyDeletionCode(keycloakId: string, code: string, secret: string): boolean {
	const expected = generateDeletionCode(keycloakId, secret);
	const provided = code.trim().toUpperCase();
	if (expected.length !== provided.length) {
		return false;
	}

	// Comparing byte by byte would leak the expected code through the time taken to answer
	return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(provided, "utf8"));
}
