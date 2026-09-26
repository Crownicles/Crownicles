import type {AuthSessionResult} from "expo-auth-session";
import {
	AUTH_FAILURES, AuthFailure, failureOfAuthResult, reasonOfUnknownError
} from "@/src/authentication/AuthFailure";

function errorResult(params: Record<string, string>, errorCode?: string): AuthSessionResult {
	return {
		type: "error",
		error: null,
		errorCode: errorCode ?? null,
		params,
		authentication: null,
		url: "crownicles://auth"
	} as unknown as AuthSessionResult;
}

describe("AuthFailure", () => {
	it("treats backing out of the browser as a cancellation, not an error", () => {
		for (const type of ["dismiss", "cancel"] as const) {
			expect(failureOfAuthResult({type} as AuthSessionResult).reason).toBe(AUTH_FAILURES.CANCELLED);
		}
	});

	it("tells a refused authorization apart from an unexplained failure", () => {
		expect(failureOfAuthResult(errorResult({error: "access_denied"})).reason).toBe(AUTH_FAILURES.DENIED);
		expect(failureOfAuthResult(errorResult({error: "server_error"})).reason).toBe(AUTH_FAILURES.UNKNOWN);
	});

	it("keeps the protocol wording out of the message shown and inside the error", () => {
		const failure = failureOfAuthResult(errorResult({
			error: "access_denied",
			error_description: "The user denied the request"
		}));

		expect(failure.message).toBe("The user denied the request");
		expect(failure.reason).not.toContain(" ");
	});

	it("reads an unreachable host from the rejection of a fetch", () => {
		expect(reasonOfUnknownError(new TypeError("Network request failed"))).toBe(AUTH_FAILURES.UNREACHABLE);
		expect(reasonOfUnknownError(new Error("anything else"))).toBe(AUTH_FAILURES.UNKNOWN);
		expect(reasonOfUnknownError(new AuthFailure(AUTH_FAILURES.INVALID_TOKEN, "detail"))).toBe(AUTH_FAILURES.INVALID_TOKEN);
	});
});
