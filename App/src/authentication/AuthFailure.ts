import type {AuthSessionResult} from "expo-auth-session";

/** What the player needs to be told, never the protocol wording behind it. */
export const AUTH_FAILURES = {
	/** The player backed out of the browser window. Closing a window is not an event to announce. */
	CANCELLED: "cancelled",
	DENIED: "denied",
	UNREACHABLE: "unreachable",
	INVALID_TOKEN: "invalidToken",
	UNKNOWN: "unknown"
} as const;

export type AuthFailureReason = typeof AUTH_FAILURES[keyof typeof AUTH_FAILURES];

export class AuthFailure extends Error {
	public readonly reason: AuthFailureReason;

	public constructor(reason: AuthFailureReason, detail: string) {
		super(detail);
		this.name = "AuthFailure";
		this.reason = reason;
	}
}

/** The one place that turns an unsuccessful authorization round-trip into something sayable. */
export function failureOfAuthResult(result: AuthSessionResult): AuthFailure {
	if (result.type === "dismiss" || result.type === "cancel") {
		return new AuthFailure(AUTH_FAILURES.CANCELLED, result.type);
	}

	if (result.type !== "error") {
		return new AuthFailure(AUTH_FAILURES.UNKNOWN, result.type);
	}

	const code = result.params.error ?? result.errorCode ?? "";
	const detail = result.error?.message ?? result.params.error_description ?? code ?? result.type;

	if (code === "access_denied" || code === "consent_required" || code === "login_required") {
		return new AuthFailure(AUTH_FAILURES.DENIED, detail);
	}

	return new AuthFailure(AUTH_FAILURES.UNKNOWN, detail);
}

export function reasonOfUnknownError(error: unknown): AuthFailureReason {
	if (error instanceof AuthFailure) {
		return error.reason;
	}

	// The fetch of a token rejects with a TypeError when the host cannot be reached at all.
	if (error instanceof TypeError) {
		return AUTH_FAILURES.UNREACHABLE;
	}

	return AUTH_FAILURES.UNKNOWN;
}
