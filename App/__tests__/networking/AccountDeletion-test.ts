import {ACCOUNT_DELETION_FAILURES, AccountDeletionRequestFailure, RestApi} from "@/src/networking/RestApi";

describe("account deletion HTTP failures", () => {
	const originalUrl = process.env.EXPO_PUBLIC_REST_API_URL;
	const originalFetch = globalThis.fetch;
	const fetch = jest.fn();

	beforeEach(() => {
		fetch.mockReset();
		globalThis.fetch = fetch;
		process.env.EXPO_PUBLIC_REST_API_URL = "https://api.example.test";
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_REST_API_URL;
		else process.env.EXPO_PUBLIC_REST_API_URL = originalUrl;
	});

	it.each([
		{status: 401, reason: ACCOUNT_DELETION_FAILURES.UNAUTHORIZED},
		{status: 403, reason: ACCOUNT_DELETION_FAILURES.INVALID_CODE},
		{status: 500, reason: ACCOUNT_DELETION_FAILURES.UNAVAILABLE},
		{status: 503, reason: ACCOUNT_DELETION_FAILURES.UNAVAILABLE}
	])("distinguishes confirmation failure $status", async ({status, reason}) => {
		fetch.mockResolvedValue({ok: false, status});
		await expect(RestApi.deleteAccount("test-token", "code")).rejects.toEqual(new AccountDeletionRequestFailure(reason));
	});

	it("normalizes only the code and authenticates with the active account token", async () => {
		fetch.mockResolvedValue({ok: true, status: 200});
		await expect(RestApi.deleteAccount("test-token", " abcd ")).resolves.toBe(true);
		expect(fetch).toHaveBeenCalledWith("https://api.example.test/account", expect.objectContaining({method: "DELETE", body: JSON.stringify({code: "ABCD"}), headers: expect.objectContaining({Authorization: "Bearer test-token"})}));
	});
});