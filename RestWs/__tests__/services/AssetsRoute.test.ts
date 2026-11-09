import fastify from "fastify";
import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { setupAssetsRoutes } from "../../src/services/routes/AssetsRoute";
import { GuildCreateConstants } from "../../../Lib/src/constants/GuildCreateConstants";
import { GuildConstants } from "../../../Lib/src/constants/GuildConstants";
import { FightConstants } from "../../../Lib/src/constants/FightConstants";
import { ONBOARDING_TRIALS } from "../../../Lib/src/constants/OnboardingConstants";

describe("assets bundle route", () => {
	const servers: ReturnType<typeof fastify>[] = [];

	async function createServer(debugMode = false): Promise<ReturnType<typeof fastify>> {
		const server = fastify();
		servers.push(server);
		await setupAssetsRoutes(server, debugMode);
		return server;
	}

	afterEach(async () => {
		await Promise.all(servers.map(server => server.close()));
		servers.length = 0;
	});

	it("returns the requested language bundle and its ETag", async () => {
		const server = await createServer();
		const response = await server.inject({ url: "/assets/bundle?lang=fr" });
		const bundle = response.json();

		expect(response.statusCode).toBe(200);
		expect(response.headers["cache-control"]).toBe("no-cache");
		expect(response.headers.etag).toMatch(/^"[a-f0-9]+"$/);
		expect(bundle.language).toBe("fr");
		expect(bundle.namespaces.app).toBeDefined();
		expect(bundle.icons).toBeDefined();
	});

	it("carries the values Core plays by", async () => {
		const server = await createServer();
		const { rules } = (await server.inject({ url: "/assets/bundle?lang=fr" })).json();

		expect(rules.guild.creationPrice).toBe(GuildCreateConstants.PRICE);
		expect(rules.textRules.guildName.max).toBe(GuildConstants.GUILD_NAME_LENGTH_RANGE.MAX);
		expect(rules.journeyLevels.fights).toBe(FightConstants.REQUIRED_LEVEL);
		expect(rules.onboardingTrials.map((trial: { id: string }) => trial.id)).toEqual(ONBOARDING_TRIALS.map(trial => trial.id));
	});

	it("returns 304 when the ETag matches", async () => {
		const server = await createServer();
		const firstResponse = await server.inject({ url: "/assets/bundle?lang=fr" });
		const response = await server.inject({
			url: "/assets/bundle?lang=fr",
			headers: { "if-none-match": firstResponse.headers.etag! }
		});

		expect(response.statusCode).toBe(304);
		expect(response.body).toBe("");
	});

	it.each(["/assets/bundle?lang=xx", "/assets/bundle"])("rejects invalid language: %s", async url => {
		const server = await createServer();
		const response = await server.inject({ url });

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({ error: "Invalid language" });
	});

	it("serves the same bundle gzip-compressed when requested", async () => {
		const server = await createServer();
		const plainResponse = await server.inject({ url: "/assets/bundle?lang=fr" });
		const compressedResponse = await server.inject({
			url: "/assets/bundle?lang=fr",
			headers: { "accept-encoding": "gzip" }
		});

		expect(compressedResponse.headers["content-encoding"]).toBe("gzip");
		expect(gunzipSync(compressedResponse.rawPayload).toString("utf8")).toBe(plainResponse.body);
	});

	it("does not gzip the bundle when gzip has a zero quality value", async () => {
		const server = await createServer();
		const plainResponse = await server.inject({ url: "/assets/bundle?lang=fr" });
		const response = await server.inject({
			url: "/assets/bundle?lang=fr",
			headers: { "accept-encoding": "gzip;q=0" }
		});

		expect(response.headers["content-encoding"]).toBeUndefined();
		expect(response.body).toBe(plainResponse.body);
	});
});