import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KeycloakUtils } from "../../src/keycloak/KeycloakUtils";
import { KeycloakConfig } from "../../src/keycloak/KeycloakConfig";
import { KeycloakUser } from "../../src/keycloak/KeycloakUser";

const CONFIG: KeycloakConfig = {
	url: "https://keycloak.test",
	realm: "test",
	clientId: "test-service",
	clientSecret: "test-secret"
};
const DISCORD_ID = "123456789012345678";
const USER_ID = "existing-keycloak-id";

function legacyUser(overrides: Partial<KeycloakUser> = {}): KeycloakUser {
	return {
		id: USER_ID, username: `discord-${DISCORD_ID}`, attributes: {gameUsername: ["existing-player"], discordId: [DISCORD_ID]},
		access: {}, createdTimestamp: 0, disableableCredentialTypes: [], emailVerified: false, enabled: true,
		firstName: "", lastName: "", notBefore: 0, requiredActions: [], ...overrides
	};
}

describe("Keycloak account identity", () => {
	beforeEach(() => {
		Reflect.set(KeycloakUtils, "keycloakToken", null);
		Reflect.set(KeycloakUtils, "keycloakTokenExpirationDate", null);
	});
	afterEach(() => vi.unstubAllGlobals());

	it("creates the Discord account and its federated identity in the same request", async () => {
		const fetch = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
			if (url.endsWith("/token")) return Response.json({access_token: "test-token", expires_in: 3600});
			if (url.includes("idpAlias=")) return Response.json([]);
			if (init?.method === "POST") return new Response(null, {status: 201});
			return Response.json([{id: USER_ID, username: `discord-${DISCORD_ID}`}]);
		});
		vi.stubGlobal("fetch", fetch);
		const result = await KeycloakUtils.registerUser(CONFIG, {
			keycloakUsername: `discord-${DISCORD_ID}`, gameUsername: "existing-player", language: "fr", discordId: DISCORD_ID
		});
		const creation = fetch.mock.calls.find(([url, init]) => url.endsWith("/users") && init?.method === "POST");
		expect(JSON.parse(creation![1]!.body as string)).toEqual({
			username: `discord-${DISCORD_ID}`,
			attributes: {language: ["fr"], gameUsername: ["existing-player"], discordId: [DISCORD_ID]},
			enabled: true,
			federatedIdentities: [{identityProvider: "discord", userId: DISCORD_ID, userName: `discord-${DISCORD_ID}`}]
		});
		expect(result).toMatchObject({isError: false, payload: {user: {id: USER_ID}}});
	});

	it("does not create a second user when the Discord identity already has an owner", async () => {
		const fetch = vi.fn(async (url: string): Promise<Response> => url.endsWith("/token")
			? Response.json({access_token: "test-token", expires_in: 3600})
			: Response.json([{id: "canonical-owner"}]));
		vi.stubGlobal("fetch", fetch);
		await expect(KeycloakUtils.registerUser(CONFIG, {keycloakUsername: `discord-${DISCORD_ID}`, discordId: DISCORD_ID, gameUsername: "player", language: "fr"})).resolves.toMatchObject({isError: true, status: 409});
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it("does not assign a Discord identity to a non-Discord account", async () => {
		const fetch = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
			if (url.endsWith("/token")) return Response.json({access_token: "test-token", expires_in: 3600});
			if (init?.method === "POST") return new Response(null, {status: 201});
			return Response.json([{id: USER_ID, username: "crownicles-player"}]);
		});
		vi.stubGlobal("fetch", fetch);
		await KeycloakUtils.registerUser(CONFIG, {keycloakUsername: "crownicles-player", gameUsername: "player", language: "fr"});
		const creation = fetch.mock.calls.find(([url, init]) => url.endsWith("/users") && init?.method === "POST");
		expect(JSON.parse(creation![1]!.body as string)).not.toHaveProperty("federatedIdentities");
	});

	it("looks up only exact email matches and safely encodes the address", async () => {
		const fetch = vi.fn(async (url: string): Promise<Response> => url.endsWith("/token")
			? Response.json({access_token: "test-token", expires_in: 3600})
			: Response.json([{id: "email-owner", email: "player+collision@example.test"}]));
		vi.stubGlobal("fetch", fetch);
		const result = await KeycloakUtils.getUsersByEmail(CONFIG, "player+collision@example.test");
		const url = new URL(fetch.mock.calls[1][0]);
		expect(url.searchParams.get("email")).toBe("player+collision@example.test");
		expect(url.searchParams.get("exact")).toBe("true");
		expect(result).toMatchObject({isError: false, payload: {users: [{id: "email-owner"}]}});
	});

	it("reads the session provider from authenticated Keycloak userinfo, not from client data", async () => {
		const fetch = vi.fn().mockResolvedValue(Response.json({sub: USER_ID, identity_provider: "discord"}));
		vi.stubGlobal("fetch", fetch);
		await expect(KeycloakUtils.getSessionIdentity(CONFIG, "synthetic-access-token")).resolves.toMatchObject({isError: false, payload: {identity: {sub: USER_ID, identity_provider: "discord"}}});
		expect(fetch).toHaveBeenCalledWith(`${CONFIG.url}/realms/${CONFIG.realm}/protocol/openid-connect/userinfo`, expect.objectContaining({headers: {Authorization: "Bearer synthetic-access-token"}}));
	});

	it("does not keep a stale Discord subject after the chosen account changes", async () => {
		let owner = "historical-subject";
		const fetch = vi.fn(async (url: string): Promise<Response> => url.endsWith("/token")
			? Response.json({access_token: "test-token", expires_in: 3600})
			: Response.json([{id: owner, attributes: {gameUsername: ["player"], discordId: [DISCORD_ID]}}]));
		vi.stubGlobal("fetch", fetch);
		await expect(KeycloakUtils.getKeycloakIdFromDiscordId(CONFIG, DISCORD_ID, null)).resolves.toMatchObject({payload: {keycloakId: "historical-subject"}});
		owner = "kept-email-subject";
		await expect(KeycloakUtils.getKeycloakIdFromDiscordId(CONFIG, DISCORD_ID, null)).resolves.toMatchObject({payload: {keycloakId: "kept-email-subject"}});
		expect(fetch.mock.calls.filter(([url]) => url.includes("?q=discordId:"))).toHaveLength(2);
	});

	it("links the historical Keycloak ID without updating or deleting either account", async () => {
		const fetch = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
			if (url.endsWith("/token")) return Response.json({access_token: "test-token", expires_in: 3600});
			if (init?.method === "POST") return new Response(null, {status: 204});
			return Response.json([]);
		});
		vi.stubGlobal("fetch", fetch);
		await expect(KeycloakUtils.linkLegacyDiscordUser(CONFIG, legacyUser())).resolves.toMatchObject({isError: false, payload: {changed: true}});
		const write = fetch.mock.calls.find(([url, init]) => url.endsWith("/federated-identity/discord") && init?.method === "POST");
		expect(write?.[0]).toContain(`/users/${USER_ID}/federated-identity/discord`);
		expect(JSON.parse(write![1]!.body as string)).toEqual({identityProvider: "discord", userId: DISCORD_ID, userName: `discord-${DISCORD_ID}`});
		expect(fetch.mock.calls.some(([_url, init]) => init?.method === "PUT" || init?.method === "DELETE")).toBe(false);
	});

	it("does nothing when the historical identity is already correctly linked", async () => {
		const fetch = vi.fn(async (url: string): Promise<Response> => {
			if (url.endsWith("/token")) return Response.json({access_token: "test-token", expires_in: 3600});
			if (url.includes("idpAlias=")) return Response.json([{id: USER_ID}]);
			return Response.json([{identityProvider: "discord", userId: DISCORD_ID}]);
		});
		vi.stubGlobal("fetch", fetch);
		await expect(KeycloakUtils.linkLegacyDiscordUser(CONFIG, legacyUser())).resolves.toMatchObject({isError: false, payload: {changed: false}});
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it("refuses a different Discord identity on the historical account", async () => {
		const fetch = vi.fn(async (url: string): Promise<Response> => {
			if (url.endsWith("/token")) return Response.json({access_token: "test-token", expires_in: 3600});
			if (url.includes("idpAlias=")) return Response.json([]);
			return Response.json([{identityProvider: "discord", userId: "different-discord-id"}]);
		});
		vi.stubGlobal("fetch", fetch);
		await expect(KeycloakUtils.linkLegacyDiscordUser(CONFIG, legacyUser())).resolves.toMatchObject({isError: true, status: 409});
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it("does not steal a Discord identity already linked to another account", async () => {
		const fetch = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
			if (url.endsWith("/token")) return Response.json({access_token: "test-token", expires_in: 3600});
			if (url.includes("idpAlias=")) return Response.json([{id: "other-keycloak-user"}]);
			if (init?.method === "POST") return Response.json({error: "identity already linked"}, {status: 409});
			return Response.json([]);
		});
		vi.stubGlobal("fetch", fetch);
		await expect(KeycloakUtils.linkLegacyDiscordUser(CONFIG, legacyUser())).resolves.toMatchObject({isError: true, status: 409});
		expect(fetch.mock.calls.some(([url, init]) => !url.endsWith("/token") && init?.method === "POST")).toBe(false);
	});

	it("accepts a concurrent identical link after reloading the historical account", async () => {
		let linked = false;
		const fetch = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
			if (url.endsWith("/token")) return Response.json({access_token: "test-token", expires_in: 3600});
			if (url.includes("idpAlias=")) return Response.json([]);
			if (init?.method === "POST") {
				linked = true;
				return Response.json({}, {status: 409});
			}
			return Response.json(linked ? [{identityProvider: "discord", userId: DISCORD_ID}] : []);
		});
		vi.stubGlobal("fetch", fetch);
		await expect(KeycloakUtils.linkLegacyDiscordUser(CONFIG, legacyUser())).resolves.toMatchObject({isError: false, payload: {changed: false}});
	});

	it.each([
		{username: "email-account"},
		{username: "discord-another-id"},
		{attributes: {gameUsername: ["existing-player"]} as KeycloakUser["attributes"]}
	])("refuses a user not matching the historical account convention ($username)", async overrides => {
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		await expect(KeycloakUtils.linkLegacyDiscordUser(CONFIG, legacyUser(overrides))).resolves.toMatchObject({isError: true, status: 400});
		expect(fetch).not.toHaveBeenCalled();
	});
});