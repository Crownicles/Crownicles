import {
	createCipheriv, createDecipheriv, randomBytes
} from "node:crypto";

const CIPHER = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

// Renewed at every start: a reference only has to outlive the page of results it was sent with.
const KEY = randomBytes(KEY_BYTES);

/**
 * An opaque handle on another player, so the app can ask for their profile without ever
 * learning their account identifier.
 * @param keycloakId
 */
export function playerReference(keycloakId: string): string {
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv(CIPHER, KEY, iv);
	const sealed = Buffer.concat([cipher.update(keycloakId, "utf8"), cipher.final()]);
	return Buffer.concat([
		iv,
		cipher.getAuthTag(),
		sealed
	]).toString("base64url");
}

/**
 * The account behind a reference this server handed out, or null when it was forged or predates a restart.
 * @param reference
 */
export function resolvePlayerReference(reference: string): string | null {
	const raw = Buffer.from(reference, "base64url");
	if (raw.length <= IV_BYTES + TAG_BYTES) {
		return null;
	}
	try {
		const decipher = createDecipheriv(CIPHER, KEY, raw.subarray(0, IV_BYTES));
		decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
		return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
	}
	catch {
		return null;
	}
}

/** No account bears this identifier, so Core answers that the player does not exist. */
const UNKNOWN_PLAYER = "unknown-player-reference";

/**
 * The account a client request targets through a reference: a forged or outdated one must end in
 * "player not found", never fall back on the requester.
 * @param reference
 */
export function referencedKeycloakId(reference: unknown): string {
	return (typeof reference === "string" ? resolvePlayerReference(reference) : null) ?? UNKNOWN_PLAYER;
}
