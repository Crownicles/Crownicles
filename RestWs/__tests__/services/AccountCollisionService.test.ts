import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountCollisionService } from "../../src/services/AccountCollisionService";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import { KeycloakUser } from "../../../Lib/src/keycloak/KeycloakUser";
import { ACCOUNT_COLLISION_CHOICES, ACCOUNT_COLLISION_ERRORS } from "../../../WsPackets/src/objects/AccountCollision";

vi.mock("../../../Lib/src/keycloak/KeycloakUtils", () => ({KeycloakUtils: {
	getSessionIdentity: vi.fn(), getUserByKeycloakId: vi.fn(), getUsersByEmail: vi.fn(), getUsersByDiscordEmail: vi.fn(),
	updateUser: vi.fn(), deleteUser: vi.fn(), linkDiscordIdentity: vi.fn(), getDiscordIdentityOwners: vi.fn(), getFederatedIdentities: vi.fn()
}}));

const CONFIG = {url: "https://keycloak.test", realm: "test", clientId: "test-service", clientSecret: "test-secret"};
const EMAIL = "player@example.test";
const DISCORD_ID = "123456789012345678";
const users = new Map<string, KeycloakUser>();

function user(id: string, overrides: Partial<KeycloakUser> = {}): KeycloakUser {
	return {id, username: id, attributes: {gameUsername: [id]}, access: {}, createdTimestamp: 0,
		disableableCredentialTypes: [], emailVerified: true, enabled: true, firstName: "", lastName: "",
		notBefore: 0, requiredActions: [], ...overrides};
}

describe("account collision resolution", () => {
	afterEach(() => vi.useRealTimers());
	beforeEach(() => {
		vi.clearAllMocks();
		users.clear();
		users.set("discord-user", user("discord-user", {username: `discord-${DISCORD_ID}`, attributes: {gameUsername: ["Historical hero"], discordId: [DISCORD_ID], discordEmail: [EMAIL], discordEmailVerified: ["true"]}}));
		users.set("email-user", user("email-user", {email: EMAIL, attributes: {gameUsername: ["New hero"]}}));
		vi.mocked(KeycloakUtils.getSessionIdentity).mockImplementation(async (_config, token) => token === "discord-token"
			? {isError: false, status: 200, payload: {identity: {sub: "discord-user", identity_provider: "discord"}}}
			: token === "email-token" ? {isError: false, status: 200, payload: {identity: {sub: "email-user"}}}
				: {isError: true, status: 401, payload: {}});
		vi.mocked(KeycloakUtils.getUserByKeycloakId).mockImplementation(async (_config, id) => {
			const account = users.get(id);
			return account ? {isError: false, status: 200, payload: {user: structuredClone(account)}} : {isError: true, status: 404, payload: {}};
		});
		vi.mocked(KeycloakUtils.getUsersByEmail).mockImplementation(async (_config, email) => ({isError: false, status: 200, payload: {users: [...users.values()].filter(account => account.email === email).map(account => structuredClone(account))}}));
		vi.mocked(KeycloakUtils.getUsersByDiscordEmail).mockImplementation(async (_config, email) => ({isError: false, status: 200, payload: {users: [...users.values()].filter(account => account.attributes.discordEmail?.[0] === email).map(account => structuredClone(account))}}));
		vi.mocked(KeycloakUtils.updateUser).mockImplementation(async (_config, account) => {
			users.set(account.id, structuredClone(account));
			return {isError: false, status: 204, payload: {}};
		});
		vi.mocked(KeycloakUtils.deleteUser).mockImplementation(async (_config, id) => {
			users.delete(id);
			return {isError: false, status: 204, payload: {}};
		});
		vi.mocked(KeycloakUtils.linkDiscordIdentity).mockResolvedValue({isError: false, status: 204, payload: {changed: true}});
		vi.mocked(KeycloakUtils.getDiscordIdentityOwners).mockResolvedValue({isError: false, status: 200, payload: {users: []}});
		vi.mocked(KeycloakUtils.getFederatedIdentities).mockResolvedValue({isError: false, status: 200, payload: {identities: []}});
	});

	it("detects the two accounts only from an authenticated Discord session", async () => {
		const service = new AccountCollisionService(CONFIG);
		await expect(service.check("discord-token")).resolves.toEqual({collision: {email: EMAIL, discord: {name: "Historical hero"}, emailAccount: {name: "New hero"}}, current: ACCOUNT_COLLISION_CHOICES.DISCORD});
		await expect(service.check("email-token")).resolves.toEqual({collision: {email: EMAIL, discord: {name: "Historical hero"}, emailAccount: {name: "New hero"}}, current: ACCOUNT_COLLISION_CHOICES.EMAIL});
	});

	it.each([
		{choice: ACCOUNT_COLLISION_CHOICES.DISCORD, token: "discord-token", kept: "discord-user", removed: "email-user"},
		{choice: ACCOUNT_COLLISION_CHOICES.EMAIL, token: "email-token", kept: "email-user", removed: "discord-user"}
	])("keeps only the chosen Keycloak account without changing its subject ($choice)", async ({choice, token, kept, removed}) => {
		const service = new AccountCollisionService(CONFIG);
		const proof = await service.verify("discord-token", "email-token");
		await expect(service.resolve(token, proof.proof, choice)).resolves.toEqual({kept: choice});
		expect(users.has(kept)).toBe(true);
		expect(users.has(removed)).toBe(false);
		expect(users.get(kept)?.id).toBe(kept);
		expect(users.get(kept)?.email).toBe(EMAIL);
		expect(users.get(kept)?.attributes.discordId).toEqual([DISCORD_ID]);
		expect(users.get(kept)?.attributes.accountCollisionResolution).toBeUndefined();
		expect(KeycloakUtils.deleteUser).toHaveBeenCalledExactlyOnceWith(CONFIG, removed);
	});

	it("does not accept the Discord token as proof of ownership of the email account", async () => {
		const service = new AccountCollisionService(CONFIG);
		await expect(service.verify("discord-token", "discord-token")).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.UNAUTHORIZED});
		expect(KeycloakUtils.deleteUser).not.toHaveBeenCalled();
	});

	it("does not allow an unverified Discord email to authorize the collision", async () => {
		users.get("discord-user")!.attributes.discordEmailVerified = ["false"];
		await expect(new AccountCollisionService(CONFIG).check("discord-token")).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.UNVERIFIED_EMAIL});
		expect(KeycloakUtils.deleteUser).not.toHaveBeenCalled();
	});

	it("requires the token of the account chosen to be kept", async () => {
		const service = new AccountCollisionService(CONFIG);
		const proof = await service.verify("discord-token", "email-token");
		await expect(service.resolve("discord-token", proof.proof, ACCOUNT_COLLISION_CHOICES.EMAIL)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.UNAUTHORIZED});
		expect(KeycloakUtils.deleteUser).not.toHaveBeenCalled();
	});

	it("rejects an expired second-account proof without deleting either identity", async () => {
		vi.useFakeTimers();
		const service = new AccountCollisionService(CONFIG);
		const proof = await service.verify("discord-token", "email-token");
		vi.advanceTimersByTime(16 * 60 * 1000);
		await expect(service.resolve("discord-token", proof.proof, ACCOUNT_COLLISION_CHOICES.DISCORD)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.PROOF_EXPIRED});
		expect(users.size).toBe(2);
		expect(KeycloakUtils.deleteUser).not.toHaveBeenCalled();
	});

	it("does not delete either account if the email changed after verification", async () => {
		const service = new AccountCollisionService(CONFIG);
		const proof = await service.verify("discord-token", "email-token");
		users.get("email-user")!.email = "different@example.test";
		await expect(service.resolve("discord-token", proof.proof, ACCOUNT_COLLISION_CHOICES.DISCORD)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED});
		expect(KeycloakUtils.deleteUser).not.toHaveBeenCalled();
	});

	it("refuses an incompatible Discord link before deleting the losing account", async () => {
		const service = new AccountCollisionService(CONFIG);
		const proof = await service.verify("discord-token", "email-token");
		vi.mocked(KeycloakUtils.getFederatedIdentities).mockResolvedValue({isError: false, status: 200, payload: {identities: [{identityProvider: "discord", userId: "another-discord-id"}]}});
		await expect(service.resolve("email-token", proof.proof, ACCOUNT_COLLISION_CHOICES.EMAIL)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.CONFLICT});
		expect(KeycloakUtils.deleteUser).not.toHaveBeenCalled();
		expect(KeycloakUtils.updateUser).not.toHaveBeenCalled();
	});

	it("refuses a third identity owner before deleting either account", async () => {
		const service = new AccountCollisionService(CONFIG);
		const proof = await service.verify("discord-token", "email-token");
		vi.mocked(KeycloakUtils.getDiscordIdentityOwners).mockResolvedValue({isError: false, status: 200, payload: {users: [user("third-user")]}});
		await expect(service.resolve("discord-token", proof.proof, ACCOUNT_COLLISION_CHOICES.DISCORD)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.CONFLICT});
		expect(KeycloakUtils.deleteUser).not.toHaveBeenCalled();
	});

	it("retains the confirmed intent after deletion failure and can resume after a service restart", async () => {
		const service = new AccountCollisionService(CONFIG);
		const proof = await service.verify("discord-token", "email-token");
		vi.mocked(KeycloakUtils.deleteUser).mockResolvedValueOnce({isError: true, status: 503, payload: {}});
		await expect(service.resolve("discord-token", proof.proof, ACCOUNT_COLLISION_CHOICES.DISCORD)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.UNAVAILABLE});
		expect(users.has("email-user")).toBe(true);
		expect(users.get("discord-user")?.attributes.accountCollisionResolution).toBeDefined();
		const restarted = new AccountCollisionService(CONFIG);
		await expect(restarted.check("discord-token")).resolves.toEqual({collision: null, pending: ACCOUNT_COLLISION_CHOICES.DISCORD});
		await expect(restarted.resolve("discord-token", "", ACCOUNT_COLLISION_CHOICES.DISCORD)).resolves.toEqual({kept: ACCOUNT_COLLISION_CHOICES.DISCORD});
		expect(users.has("email-user")).toBe(false);
	});

	it("resumes after the losing identity was deleted but linking was interrupted", async () => {
		const service = new AccountCollisionService(CONFIG);
		const proof = await service.verify("discord-token", "email-token");
		vi.mocked(KeycloakUtils.linkDiscordIdentity).mockResolvedValueOnce({isError: true, status: 503, payload: {}});
		await expect(service.resolve("email-token", proof.proof, ACCOUNT_COLLISION_CHOICES.EMAIL)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.CONFLICT});
		expect(users.has("discord-user")).toBe(false);
		await expect(new AccountCollisionService(CONFIG).resolve("email-token", "", ACCOUNT_COLLISION_CHOICES.EMAIL)).resolves.toEqual({kept: ACCOUNT_COLLISION_CHOICES.EMAIL});
		expect(users.get("email-user")?.attributes.discordId).toEqual([DISCORD_ID]);
	});

	it("serializes opposite confirmations so they cannot delete both accounts", async () => {
		const service = new AccountCollisionService(CONFIG);
		const first = await service.verify("discord-token", "email-token");
		const second = await service.verify("discord-token", "email-token");
		const results = await Promise.allSettled([
			service.resolve("discord-token", first.proof, ACCOUNT_COLLISION_CHOICES.DISCORD),
			service.resolve("email-token", second.proof, ACCOUNT_COLLISION_CHOICES.EMAIL)
		]);
		expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
		expect(users.size).toBe(1);
		expect(KeycloakUtils.deleteUser).toHaveBeenCalledTimes(1);
	});
});