import fastify from "fastify";
import {
	afterEach, describe, expect, it
} from "vitest";
import { setupAppCompatibilityRoutes } from "../../src/services/routes/AppCompatibilityRoute";
import { APP_PROTOCOL_VERSION } from "../../../WsPackets/src/AppCompatibility";

describe("app compatibility route", () => {
	const server = fastify();

	afterEach(async () => {
		await server.close();
	});

	it("tells the app which protocol this server speaks", async () => {
		setupAppCompatibilityRoutes(server);
		const response = await server.inject({ url: "/app/compatibility" });

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ protocolVersion: APP_PROTOCOL_VERSION });
	});
});
