import * as crypto from "crypto";
import { Collection } from "discord.js";
import { Language } from "../../../Lib/src/Language";

/**
 * Secret generated at bot startup - changes on each restart for additional security
 * This means deletion codes become invalid after a bot restart
 */
const BOT_DELETION_SECRET = crypto.randomBytes(32).toString("hex");

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
	fr: "CONFIRMER QUE JE SOUHAITE SUPPRIMER MON COMPTE ET QUE JE NE POURRAIS PAS LE RECUPERER",
	en: "CONFIRM THAT I WANT TO DELETE MY ACCOUNT AND THAT I WILL NOT BE ABLE TO RECOVER IT",
	es: "CONFIRMAR QUE DESEO ELIMINAR MI CUENTA Y QUE NO PODRE RECUPERARLA",
	de: "BESTATIGEN DASS ICH MEIN KONTO LOSCHEN MOCHTE UND DASS ICH ES NICHT WIEDERHERSTELLEN KANN",
	it: "CONFERMARE CHE DESIDERO ELIMINARE IL MIO ACCOUNT E CHE NON POTRO RECUPERARLO",
	pt: "CONFIRMAR QUE DESEJO EXCLUIR MINHA CONTA E QUE NAO PODEREI RECUPERA LA"
};

/**
 * Generates a deterministic 16-character hex code for account deletion
 * The code is derived from the keycloakId and the bot's startup secret
 * @param keycloakId - The user's Keycloak ID
 * @returns A 16-character uppercase hex string
 */
export function generateDeletionCode(keycloakId: string): string {
	return crypto.createHmac("sha256", BOT_DELETION_SECRET)
		.update(keycloakId)
		.digest("hex")
		.substring(0, 16)
		.toUpperCase();
}

/**
 * Verifies if a given code matches the expected deletion code for a keycloakId
 * @param keycloakId - The user's Keycloak ID
 * @param code - The code provided by the user
 * @returns True if the code is valid
 */
export function verifyDeletionCode(keycloakId: string, code: string): boolean {
	return generateDeletionCode(keycloakId) === code.toUpperCase().trim();
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
 * Checks if a message content matches the DELETE ACCOUNT pattern
 * @param content - The message content
 * @returns The extracted code or null if not a delete account message
 */
export function extractDeletionCode(content: string): string | null {
	const match = content.trim().match(/^DELETE\s+ACCOUNT\s+([A-Fa-f0-9]{16})$/i);
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
