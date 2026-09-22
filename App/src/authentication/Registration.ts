import {RestApi} from "@/src/networking/RestApi";
import {currentLanguage} from "@/src/translations/i18nLoader";

/** What the player needs to be told, never the status code behind it. */
export const REGISTRATION_FAILURES = {
	INVALID: "invalid",
	TAKEN: "taken",
	MAIL_UNAVAILABLE: "mailUnavailable",
	CLOSED: "closed",
	UNREACHABLE: "unreachable",
	UNKNOWN: "unknown"
} as const;

export type RegistrationFailureReason = typeof REGISTRATION_FAILURES[keyof typeof REGISTRATION_FAILURES];

/** Mirrors the `length(10)` password policy of the realm, which would otherwise reject in a round-trip. */
export const MINIMUM_PASSWORD_LENGTH = 10;

/** Mirrors `RegisteringConstants.DISALLOWED_USERNAME_PREFIXES`, reserved for accounts the bot creates. */
const RESERVED_USERNAME_PREFIXES = ["discord-"];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/u;

export class RegistrationFailure extends Error {
	public readonly reason: RegistrationFailureReason;

	public constructor(reason: RegistrationFailureReason, detail: string) {
		super(detail);
		this.name = "RegistrationFailure";
		this.reason = reason;
	}
}

export type AccountDraft = {
	username: string;
	email: string;
	password: string;
};

/** Why the draft cannot be sent yet, so the screen can say it before the button is pressed. */
export function draftRejection(draft: AccountDraft): RegistrationFailureReason | null {
	if (draft.username.trim().length === 0 || draft.email.trim().length === 0 || draft.password.length === 0) {
		return REGISTRATION_FAILURES.INVALID;
	}

	if (RESERVED_USERNAME_PREFIXES.some(prefix => draft.username.trim().toLowerCase().startsWith(prefix))) {
		return REGISTRATION_FAILURES.TAKEN;
	}

	if (!EMAIL_PATTERN.test(draft.email.trim()) || draft.password.length < MINIMUM_PASSWORD_LENGTH) {
		return REGISTRATION_FAILURES.INVALID;
	}

	return null;
}

function reasonOfStatus(status: number): RegistrationFailureReason {
	switch (status) {
		case 400:
			return REGISTRATION_FAILURES.INVALID;
		case 403:
			return REGISTRATION_FAILURES.CLOSED;
		case 409:
			return REGISTRATION_FAILURES.TAKEN;
		case 503:
			return REGISTRATION_FAILURES.MAIL_UNAVAILABLE;
		default:
			return REGISTRATION_FAILURES.UNKNOWN;
	}
}

/**
 * Creates the account and asks the server to send the address verification mail.
 *
 * The account only becomes usable once that mail is answered, so a success here is an invitation to
 * go and read it, not a sign-in.
 */
export async function registerAccount(draft: AccountDraft): Promise<void> {
	let status: number;

	try {
		status = await RestApi.register({
			username: draft.username.trim(),
			email: draft.email.trim(),
			password: draft.password,
			language: currentLanguage()
		});
	}
	catch (error) {
		throw new RegistrationFailure(REGISTRATION_FAILURES.UNREACHABLE, String(error));
	}

	if (status >= 200 && status < 300) {
		return;
	}

	throw new RegistrationFailure(reasonOfStatus(status), `status ${status}`);
}
