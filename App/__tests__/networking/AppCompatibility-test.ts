import { AppIncompatibilityFailure, RestApi } from "@/src/networking/RestApi";
import { APP_PROTOCOL_HEADER, APP_PROTOCOL_VERSION } from "ws-packets/src/AppCompatibility";

function answer(status: number, body: object = {}): void {
	jest.spyOn(globalThis, "fetch").mockResolvedValue({
		ok: status < 400, status, json: async () => body
	} as Response);
}

describe("app compatibility check", () => {
	beforeEach(() => {
		process.env.EXPO_PUBLIC_REST_API_URL = "https://api.test";
	});
	afterEach(() => jest.restoreAllMocks());

	it.each([
		{
			case: "the same protocol", body: { protocolVersion: APP_PROTOCOL_VERSION }, expected: "upToDate"
		},
		{
			case: "a newer server", body: { protocolVersion: APP_PROTOCOL_VERSION + 1 }, expected: "appOutdated"
		},
		{
			case: "an older server", body: { protocolVersion: APP_PROTOCOL_VERSION - 1 }, expected: "serverOutdated"
		}
	])("tells which side is behind against $case", async ({
		body, expected
	}) => {
		answer(200, body);
		await expect(RestApi.getCompatibility()).resolves.toBe(expected);
	});

	it("treats a server without the route as the one to update", async () => {
		answer(404);
		await expect(RestApi.getCompatibility()).resolves.toBe("serverOutdated");
	});

	it("remembers a refusal until a check finds both sides in step, even across an unreachable server", async () => {
		jest.spyOn(console, "warn").mockImplementation(() => undefined);
		answer(200, { protocolVersion: APP_PROTOCOL_VERSION + 1 });
		await RestApi.getCompatibility();
		expect(RestApi.knownIncompatibility()).toBe("appOutdated");

		jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
		await RestApi.getCompatibility();
		expect(RestApi.knownIncompatibility()).toBe("appOutdated");

		answer(200, { protocolVersion: APP_PROTOCOL_VERSION });
		await RestApi.getCompatibility();
		expect(RestApi.knownIncompatibility()).toBeNull();
	});

	it("leaves the decision to the connection when the server cannot be reached", async () => {
		jest.spyOn(console, "warn").mockImplementation(() => undefined);
		jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
		await expect(RestApi.getCompatibility()).resolves.toBeNull();
	});

	it("announces its protocol before a session opens, and says which side a refusal asks to update", async () => {
		answer(426, { error: "serverOutdated" });
		const refusal = RestApi.checkAccountCollision("session-access");
		await expect(refusal).rejects.toBeInstanceOf(AppIncompatibilityFailure);
		await expect(refusal).rejects.toMatchObject({ status: "serverOutdated" });
		const [, init] = jest.mocked(globalThis.fetch).mock.calls[0];
		expect((init?.headers as Record<string, string>)[APP_PROTOCOL_HEADER]).toBe(String(APP_PROTOCOL_VERSION));
	});
});
