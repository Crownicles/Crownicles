import {
	createHmac,
	randomBytes,
	timingSafeEqual
} from "crypto";
import { Collection } from "discord.js";
import { Language } from "../../../Lib/src/Language";
import { discordConfig } from "../bot/CrowniclesShard";

/**
 * Size in bytes for the bot deletion secret
 */
const SECRET_SIZE_BYTES = 32;

/**
 * Length of the deletion code in hexadecimal characters
 */
const DELETION_CODE_LENGTH = 16;

/**
 * Gets the deletion secret from config (shared across all shards) or falls back to a random one
 * The config secret is preferred as it persists across restarts and is shared between shards
 */
function getDeletionSecret(): string {
	if (discordConfig.DELETION_SECRET && discordConfig.DELETION_SECRET.length > 0) {
		return discordConfig.DELETION_SECRET;
	}

	// Fallback for backwards compatibility - will log a warning
	console.warn("[AccountDeletion] No deletion_secret configured in config.toml. Using random secret (codes will not persist across restarts or work across shards).");
	return randomBytes(SECRET_SIZE_BYTES).toString("hex");
}

/**
 * Store pending deletion confirmations: discordId -> { keycloakId, language, expiresAt }
 * Used to track users who have entered a valid code and need to type the confirmation phrase
 */
const pendingDeletions = new Collection<string, {
	keycloakId: string;
	language: Language;
	expiresAt: number;
}>();

/**
 * Track failed code attempts for rate limiting: discordId -> { attempts, resetAt }
 */
const failedAttempts = new Collection<string, {
	attempts: number;
	resetAt: number;
}>();

/**
 * Maximum allowed failed attempts before temporary block
 */
const MAX_FAILED_ATTEMPTS = 15;

/**
 * Time in milliseconds to block after too many failed attempts (15 minutes)
 */
const RATE_LIMIT_DURATION = 15 * 60 * 1000;

/**
 * Time in milliseconds for how long a deletion confirmation is valid (5 minutes)
 */
const DELETION_CONFIRMATION_TIMEOUT = 5 * 60 * 1000;

/**
 * The confirmation phrases that users must type to confirm account deletion
 * Key is the language code, value is the exact phrase to type
 */
export const DELETION_CONFIRMATION_PHRASES: Record<string, string> = {
	fr: "CONFIRMER QUE JE SOUHAITE SUPPRIMER MON COMPTE ET QUE JE NE POURRAI PAS LE RÉCUPÉRER",
	en: "CONFIRM THAT I WANT TO DELETE MY ACCOUNT AND THAT I WILL NOT BE ABLE TO RECOVER IT",
	es: "CONFIRMAR QUE DESEO ELIMINAR MI CUENTA Y QUE NO PODRÉ RECUPERARLA",
	de: "BESTÄTIGEN DASS ICH MEIN KONTO LÖSCHEN MÖCHTE UND DASS ICH ES NICHT WIEDERHERSTELLEN KANN",
	it: "CONFERMARE CHE DESIDERO ELIMINARE IL MIO ACCOUNT E CHE NON POTRÒ RECUPERARLO",
	pt: "CONFIRMAR QUE DESEJO EXCLUIR MINHA CONTA E QUE NÃO PODEREI RECUPERÁ-LA"
};

/**
 * Generates a deterministic deletion code for account deletion
 * The code is derived from the keycloakId and the configured deletion secret
 * @param keycloakId - The user's Keycloak ID
 * @returns An uppercase hex string of DELETION_CODE_LENGTH characters
 */
export function generateDeletionCode(keycloakId: string): string {
	return createHmac("sha256", getDeletionSecret())
		.update(keycloakId)
		.digest("hex")
		.substring(0, DELETION_CODE_LENGTH)
		.toUpperCase();
}

/**
 * Verifies if a given code matches the expected deletion code for a keycloakId
 * Uses timing-safe comparison to prevent timing attacks
 * @param keycloakId - The user's Keycloak ID
 * @param code - The code provided by the user
 * @returns True if the code is valid
 */
export function verifyDeletionCode(keycloakId: string, code: string): boolean {
	const expected = generateDeletionCode(keycloakId);
	const provided = code.trim().toUpperCase();
	if (expected.length !== provided.length) {
		return false;
	}
	return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(provided, "utf8"));
}

/**
 * Checks if a user is rate limited from attempting deletion codes
 * @param discordId - The user's Discord ID
 * @returns True if the user is currently rate limited
 */
export function isRateLimited(discordId: string): boolean {
	const record = failedAttempts.get(discordId);
	if (!record) {
		return false;
	}
	if (Date.now() > record.resetAt) {
		failedAttempts.delete(discordId);
		return false;
	}
	return record.attempts >= MAX_FAILED_ATTEMPTS;
}

/**
 * Records a failed deletion code attempt for rate limiting
 * @param discordId - The user's Discord ID
 */
export function recordFailedAttempt(discordId: string): void {
	const record = failedAttempts.get(discordId);
	const now = Date.now();

	if (!record || now > record.resetAt) {
		failedAttempts.set(discordId, {
			attempts: 1,
			resetAt: now + RATE_LIMIT_DURATION
		});
	}
	else {
		record.attempts++;
	}
}

/**
 * Clears failed attempts after successful code verification
 * @param discordId - The user's Discord ID
 */
export function clearFailedAttempts(discordId: string): void {
	failedAttempts.delete(discordId);
}

/**
 * Sets a pending deletion for a user after they've entered a valid code
 * @param discordId - The user's Discord ID
 * @param keycloakId - The user's Keycloak ID
 * @param language - The user's preferred language
 */
export function setPendingDeletion(discordId: string, keycloakId: string, language: Language): void {
	pendingDeletions.set(discordId, {
		keycloakId,
		language,
		expiresAt: Date.now() + DELETION_CONFIRMATION_TIMEOUT
	});
}

/**
 * Gets a pending deletion for a user if it exists and hasn't expired
 * @param discordId - The user's Discord ID
 * @returns The pending deletion info or null if not found/expired
 */
export function getPendingDeletion(discordId: string): {
	keycloakId: string; language: Language;
} | null {
	const pending = pendingDeletions.get(discordId);
	if (!pending) {
		return null;
	}
	if (Date.now() > pending.expiresAt) {
		pendingDeletions.delete(discordId);
		return null;
	}
	return {
		keycloakId: pending.keycloakId, language: pending.language
	};
}

/**
 * Removes a pending deletion after successful deletion or cancellation
 * @param discordId - The user's Discord ID
 */
export function clearPendingDeletion(discordId: string): void {
	pendingDeletions.delete(discordId);
}

/**
 * Regex pattern to match the DELETE ACCOUNT command with a valid deletion code
 */
const DELETE_ACCOUNT_PATTERN = new RegExp(`^DELETE\\s+ACCOUNT\\s+([A-Fa-f0-9]{${DELETION_CODE_LENGTH}})$`, "i");

/**
 * Checks if a message content matches the DELETE ACCOUNT pattern
 * @param content - The message content
 * @returns The extracted code or null if not a delete account message
 */
export function extractDeletionCode(content: string): string | null {
	const match = content.trim().match(DELETE_ACCOUNT_PATTERN);
	return match ? match[1].toUpperCase() : null;
}

/**
 * Checks if a message content is a valid deletion confirmation phrase
 * @param content - The message content
 * @returns True if the content matches any of the confirmation phrases
 */
export function isValidConfirmationPhrase(content: string): boolean {
	const normalizedContent = content.trim().toUpperCase();
	return Object.values(DELETION_CONFIRMATION_PHRASES).some(
		phrase => normalizedContent === phrase.toUpperCase()
	);
}

/**
 * Gets the confirmation phrase for a given language
 * @param language - The language code (fr, en, etc.)
 * @returns The confirmation phrase for that language, defaults to French
 */
export function getConfirmationPhrase(language: string): string {
	return DELETION_CONFIRMATION_PHRASES[language] ?? DELETION_CONFIRMATION_PHRASES.fr;
}
