import {RestApi} from "@/src/networking/RestApi";
import {APP_PROTOCOL_VERSION} from "ws-packets/src/AppCompatibility";

function answer(status: number, body: object = {}): void {
	jest.spyOn(globalThis, "fetch").mockResolvedValue({ok: status < 400, status, json: async () => body} as Response);
}

describe("app compatibility check", () => {
	beforeEach(() => {
		process.env.EXPO_PUBLIC_REST_API_URL = "https://api.test";
	});
	afterEach(() => jest.restoreAllMocks());

	it.each([
		{case: "the same protocol", body: {protocolVersion: APP_PROTOCOL_VERSION}, expected: "upToDate"},
		{case: "a newer server", body: {protocolVersion: APP_PROTOCOL_VERSION + 1}, expected: "appOutdated"},
		{case: "an older server", body: {protocolVersion: APP_PROTOCOL_VERSION - 1}, expected: "serverOutdated"}
	])("tells which side is behind against $case", async ({body, expected}) => {
		answer(200, body);
		await expect(RestApi.getCompatibility()).resolves.toBe(expected);
	});

	it("treats a server without the route as the one to update", async () => {
		answer(404);
		await expect(RestApi.getCompatibility()).resolves.toBe("serverOutdated");
	});

	it("leaves the decision to the connection when the server cannot be reached", async () => {
		jest.spyOn(console, "warn").mockImplementation(() => undefined);
		jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
		await expect(RestApi.getCompatibility()).resolves.toBeNull();
	});
});
