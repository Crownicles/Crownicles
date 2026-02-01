import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from "vitest";
import { LANGUAGE } from "../../../Lib/src/Language";

// Mock CrowniclesLogger to avoid "Logger not initialized" error
vi.mock("../../../Lib/src/logs/CrowniclesLogger", () => ({
	CrowniclesLogger: {
		warn: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
		isInitialized: vi.fn(() => true)
	}
}));

// Mock discordConfig to provide a test deletion secret
vi.mock("../../src/bot/CrowniclesShard", () => ({
	discordConfig: {
		DELETION_SECRET: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	}
}));

// Import after mocks are set up
import {
	clearFailedAttempts,
	clearPendingDeletion,
	DELETION_CONFIRMATION_PHRASES,
	extractDeletionCode,
	generateDeletionCode,
	getConfirmationPhrase,
	getPendingDeletion,
	isRateLimited,
	isValidConfirmationPhrase,
	recordFailedAttempt,
	setPendingDeletion,
	verifyDeletionCode
} from "../../src/utils/AccountDeletionUtils";

describe("AccountDeletionUtils", () => {
	const testKeycloakId = "test-keycloak-id-12345";
	const testDiscordId = "discord-user-12345";

	beforeEach(() => {
		// Clear any state between tests
		clearPendingDeletion(testDiscordId);
		clearFailedAttempts(testDiscordId);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("generateDeletionCode", () => {
		it("should generate a 16-character uppercase hex code", () => {
			const code = generateDeletionCode(testKeycloakId);

			expect(code).toHaveLength(16);
			expect(code).toMatch(/^[A-F0-9]{16}$/);
		});

		it("should generate deterministic codes for the same keycloakId", () => {
			const code1 = generateDeletionCode(testKeycloakId);
			const code2 = generateDeletionCode(testKeycloakId);

			expect(code1).toBe(code2);
		});

		it("should generate different codes for different keycloakIds", () => {
			const code1 = generateDeletionCode("user-1");
			const code2 = generateDeletionCode("user-2");

			expect(code1).not.toBe(code2);
		});
	});

	describe("verifyDeletionCode", () => {
		it("should return true for a valid code", () => {
			const code = generateDeletionCode(testKeycloakId);

			expect(verifyDeletionCode(testKeycloakId, code)).toBe(true);
		});

		it("should return true for a valid code with different case", () => {
			const code = generateDeletionCode(testKeycloakId);

			expect(verifyDeletionCode(testKeycloakId, code.toLowerCase())).toBe(true);
		});

		it("should return true for a valid code with whitespace", () => {
			const code = generateDeletionCode(testKeycloakId);

			expect(verifyDeletionCode(testKeycloakId, `  ${code}  `)).toBe(true);
		});

		it("should return false for an invalid code", () => {
			expect(verifyDeletionCode(testKeycloakId, "INVALID1234567890")).toBe(false);
		});

		it("should return false for a code with wrong length", () => {
			expect(verifyDeletionCode(testKeycloakId, "SHORT")).toBe(false);
		});
	});

	describe("extractDeletionCode", () => {
		it("should extract a valid deletion code from a DELETE ACCOUNT message", () => {
			const code = generateDeletionCode(testKeycloakId);

			expect(extractDeletionCode(`DELETE ACCOUNT ${code}`)).toBe(code);
		});

		it("should handle lowercase command", () => {
			const code = generateDeletionCode(testKeycloakId);

			const result = extractDeletionCode(`delete account ${code.toLowerCase()}`);
			expect(result).toBe(code);
		});

		it("should handle extra whitespace", () => {
			const code = generateDeletionCode(testKeycloakId);

			expect(extractDeletionCode(`  DELETE   ACCOUNT   ${code}  `)).toBe(code);
		});

		it("should return null for invalid format", () => {
			expect(extractDeletionCode("DELETE ACCOUNT")).toBeNull();
			expect(extractDeletionCode("DELETE ACCOUNT SHORT")).toBeNull();
			expect(extractDeletionCode("DELETEACCOUNT 1234567890123456")).toBeNull();
			expect(extractDeletionCode("random message")).toBeNull();
		});

		it("should return null for non-hex codes", () => {
			expect(extractDeletionCode("DELETE ACCOUNT GHIJKLMNOPQRSTUV")).toBeNull();
		});
	});

	describe("Rate limiting", () => {
		it("should not rate limit a user with no failed attempts", () => {
			expect(isRateLimited(testDiscordId)).toBe(false);
		});

		it("should not rate limit after a few failed attempts", () => {
			for (let i = 0; i < 5; i++) {
				recordFailedAttempt(testDiscordId);
			}

			expect(isRateLimited(testDiscordId)).toBe(false);
		});

		it("should rate limit after 15 failed attempts", () => {
			for (let i = 0; i < 15; i++) {
				recordFailedAttempt(testDiscordId);
			}

			expect(isRateLimited(testDiscordId)).toBe(true);
		});

		it("should clear rate limit after clearing failed attempts", () => {
			for (let i = 0; i < 15; i++) {
				recordFailedAttempt(testDiscordId);
			}
			expect(isRateLimited(testDiscordId)).toBe(true);

			clearFailedAttempts(testDiscordId);
			expect(isRateLimited(testDiscordId)).toBe(false);
		});

		it("should reset rate limit after duration expires", () => {
			vi.useFakeTimers();

			for (let i = 0; i < 15; i++) {
				recordFailedAttempt(testDiscordId);
			}
			expect(isRateLimited(testDiscordId)).toBe(true);

			// Advance time by 15 minutes + 1ms
			vi.advanceTimersByTime(15 * 60 * 1000 + 1);

			expect(isRateLimited(testDiscordId)).toBe(false);
		});
	});

	describe("Pending deletions", () => {
		it("should return null when no pending deletion exists", () => {
			expect(getPendingDeletion(testDiscordId)).toBeNull();
		});

		it("should set and get a pending deletion", () => {
			setPendingDeletion(testDiscordId, testKeycloakId, LANGUAGE.FRENCH);

			const pending = getPendingDeletion(testDiscordId);
			expect(pending).not.toBeNull();
			expect(pending?.keycloakId).toBe(testKeycloakId);
			expect(pending?.language).toBe(LANGUAGE.FRENCH);
		});

		it("should clear a pending deletion", () => {
			setPendingDeletion(testDiscordId, testKeycloakId, LANGUAGE.FRENCH);
			expect(getPendingDeletion(testDiscordId)).not.toBeNull();

			clearPendingDeletion(testDiscordId);
			expect(getPendingDeletion(testDiscordId)).toBeNull();
		});

		it("should expire pending deletion after 5 minutes", () => {
			vi.useFakeTimers();

			setPendingDeletion(testDiscordId, testKeycloakId, LANGUAGE.FRENCH);
			expect(getPendingDeletion(testDiscordId)).not.toBeNull();

			// Advance time by 5 minutes + 1ms
			vi.advanceTimersByTime(5 * 60 * 1000 + 1);

			expect(getPendingDeletion(testDiscordId)).toBeNull();
		});
	});

	describe("Confirmation phrases", () => {
		it("should have confirmation phrases for all supported languages", () => {
			const expectedLanguages = ["fr", "en", "es", "de", "it", "pt"];

			for (const lang of expectedLanguages) {
				expect(DELETION_CONFIRMATION_PHRASES[lang]).toBeDefined();
				expect(DELETION_CONFIRMATION_PHRASES[lang].length).toBeGreaterThan(0);
			}
		});

		it("should validate correct confirmation phrases", () => {
			for (const phrase of Object.values(DELETION_CONFIRMATION_PHRASES)) {
				expect(isValidConfirmationPhrase(phrase)).toBe(true);
			}
		});

		it("should validate confirmation phrases case-insensitively", () => {
			const frPhrase = DELETION_CONFIRMATION_PHRASES.fr;

			expect(isValidConfirmationPhrase(frPhrase.toLowerCase())).toBe(true);
		});

		it("should validate confirmation phrases with whitespace", () => {
			const frPhrase = DELETION_CONFIRMATION_PHRASES.fr;

			expect(isValidConfirmationPhrase(`  ${frPhrase}  `)).toBe(true);
		});

		it("should reject invalid confirmation phrases", () => {
			expect(isValidConfirmationPhrase("invalid phrase")).toBe(false);
			expect(isValidConfirmationPhrase("")).toBe(false);
			expect(isValidConfirmationPhrase("CONFIRM")).toBe(false);
		});

		it("should return the correct phrase for each language", () => {
			expect(getConfirmationPhrase("fr")).toBe(DELETION_CONFIRMATION_PHRASES.fr);
			expect(getConfirmationPhrase("en")).toBe(DELETION_CONFIRMATION_PHRASES.en);
			expect(getConfirmationPhrase("es")).toBe(DELETION_CONFIRMATION_PHRASES.es);
		});

		it("should default to French for unknown languages", () => {
			expect(getConfirmationPhrase("unknown")).toBe(DELETION_CONFIRMATION_PHRASES.fr);
			expect(getConfirmationPhrase("")).toBe(DELETION_CONFIRMATION_PHRASES.fr);
		});
	});
});
