import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountCollisionService } from "../../src/services/AccountCollisionService";
import { KeycloakUtils } from "../../../Lib/src/keycloak/KeycloakUtils";
import { KeycloakUser } from "../../../Lib/src/keycloak/KeycloakUser";
import { ACCOUNT_COLLISION_CHOICES, ACCOUNT_COLLISION_ERRORS } from "../../../WsPackets/src/objects/AccountCollision";

vi.mock("../../../Lib/src/keycloak/KeycloakUtils", () => ({KeycloakUtils: {
	getSessionIdentity: vi.fn(), getUserByKeycloakId: vi.fn(), getUsersByEmail: vi.fn(), getUsersByDiscordEmail: vi.fn(),
	patchUser: vi.fn(), deleteUser: vi.fn(), linkDiscordIdentity: vi.fn(), getDiscordIdentityOwners: vi.fn(), getFederatedIdentities: vi.fn()
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
		vi.mocked(KeycloakUtils.patchUser).mockImplementation(async (_config, id, change) => {
			const account = users.get(id);
			if (!account) {
				return {isError: true, status: 404, payload: {}};
			}
			users.set(id, structuredClone(change(structuredClone(account))));
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

	it("detects the two accounts from either account's session", async () => {
		const service = new AccountCollisionService(CONFIG);
		const collision = {email: EMAIL, discord: {name: "Historical hero", createdAt: 0}, emailAccount: {keycloakId: "email-user", name: "New hero", createdAt: 0}};
		await expect(service.check("discord-token")).resolves.toEqual({collision, current: ACCOUNT_COLLISION_CHOICES.DISCORD});
		await expect(service.check("email-token")).resolves.toEqual({collision, current: ACCOUNT_COLLISION_CHOICES.EMAIL});
	});

	it.each([
		{displayName: "Public Discord hero", username: "discord.hero", expected: "Public Discord hero"},
		{displayName: "", username: "discord.hero", expected: "discord.hero"}
	])("uses Discord's public profile instead of the internal username ($expected)", async ({displayName, username, expected}) => {
		const discord = users.get("discord-user")!;
		discord.attributes.gameUsername = [discord.username];
		discord.attributes.discordDisplayName = [displayName];
		discord.attributes.discordUsername = [username];
		users.get("email-user")!.attributes.discordDisplayName = ["Other linked Discord profile"];
		const check = await new AccountCollisionService(CONFIG).check("discord-token");
		expect(check.collision?.discord.name).toBe(expected);
		expect(check.collision?.emailAccount.name).toBe("New hero");
		expect(discord.attributes.gameUsername).toEqual([discord.username]);
		expect(KeycloakUtils.patchUser).not.toHaveBeenCalled();
	});

	it("describes each account with its creation date and the adventure the game knows of it", async () => {
		users.get("discord-user")!.createdTimestamp = 1_600_000_000_000;
		users.get("email-user")!.createdTimestamp = 1_700_000_000_000;
		const adventures = vi.fn().mockResolvedValue([{keycloakId: "discord-user", level: 42, score: 12_345, classId: 7}]);
		const check = await new AccountCollisionService(CONFIG, undefined, adventures).preview("email-token");
		expect(adventures).toHaveBeenCalledExactlyOnceWith("email-user", ["discord-user", "email-user"]);
		expect(check.collision).toEqual({
			email: EMAIL,
			discord: {name: "Historical hero", createdAt: 1_600_000_000_000, progressionAvailable: true, adventure: {level: 42, score: 12_345, classId: 7}},
			emailAccount: {keycloakId: "email-user", name: "New hero", createdAt: 1_700_000_000_000, progressionAvailable: true}
		});
	});

	it("tells a progression the game could not read apart from an account without one", async () => {
		const check = await new AccountCollisionService(CONFIG, undefined, vi.fn().mockResolvedValue(null)).preview("discord-token");
		expect(check.collision?.discord).toEqual({name: "Historical hero", createdAt: 0, progressionAvailable: false});
		expect(check.collision?.emailAccount.progressionAvailable).toBe(false);
	});

	it("never waits for the game to tell whether a collision blocks the session", async () => {
		const adventures = vi.fn();
		const check = await new AccountCollisionService(CONFIG, undefined, adventures).check("discord-token");
		expect(adventures).not.toHaveBeenCalled();
		expect(check.collision?.discord).not.toHaveProperty("progressionAvailable");
	});

	it("detects the Discord side even when the session does not name its identity provider", async () => {
		vi.mocked(KeycloakUtils.getSessionIdentity).mockResolvedValue({isError: false, status: 200, payload: {identity: {sub: "discord-user"}}});
		await expect(new AccountCollisionService(CONFIG).check("discord-token")).resolves.toMatchObject({current: ACCOUNT_COLLISION_CHOICES.DISCORD});
	});

	it.each([
		{choice: ACCOUNT_COLLISION_CHOICES.DISCORD, token: "discord-token", kept: "discord-user", removed: "email-user"},
		{choice: ACCOUNT_COLLISION_CHOICES.EMAIL, token: "email-token", kept: "email-user", removed: "discord-user"}
	])("keeps only the chosen Keycloak account without changing its subject ($choice)", async ({choice, token, kept, removed}) => {
		const service = new AccountCollisionService(CONFIG);
		await expect(service.resolve(token, token === "discord-token" ? "email-token" : "discord-token", choice)).resolves.toEqual({kept: choice});
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
		await expect(service.resolve("discord-token", "discord-token", ACCOUNT_COLLISION_CHOICES.DISCORD)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.UNAUTHORIZED});
		expect(KeycloakUtils.deleteUser).not.toHaveBeenCalled();
	});

	it("ignores a Discord email that Discord has not verified", async () => {
		users.get("discord-user")!.attributes.discordEmailVerified = ["false"];
		const service = new AccountCollisionService(CONFIG);
		await expect(service.check("discord-token")).resolves.toEqual({collision: null});
		await expect(service.check("email-token")).resolves.toEqual({collision: null});
		await expect(service.resolve("discord-token", "email-token", ACCOUNT_COLLISION_CHOICES.DISCORD)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED});
	});

	it("does not let an account that never verified the address block the Discord account", async () => {
		users.get("email-user")!.emailVerified = false;
		const service = new AccountCollisionService(CONFIG);
		await expect(service.check("discord-token")).resolves.toEqual({collision: null});
		await expect(service.check("email-token")).resolves.toEqual({collision: null});
	});

	it("requires the token of the account chosen to be kept", async () => {
		const service = new AccountCollisionService(CONFIG);
		await expect(service.resolve("discord-token", "email-token", ACCOUNT_COLLISION_CHOICES.EMAIL)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.UNAUTHORIZED});
		expect(KeycloakUtils.deleteUser).not.toHaveBeenCalled();
	});

	it("rejects an expired second session without deleting either identity", async () => {
		const service = new AccountCollisionService(CONFIG);
		await expect(service.resolve("discord-token", "expired-email-token", ACCOUNT_COLLISION_CHOICES.DISCORD)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.UNAUTHORIZED});
		expect(users.size).toBe(2);
		expect(KeycloakUtils.deleteUser).not.toHaveBeenCalled();
	});

	it("does not delete either account if the email changed after verification", async () => {
		const service = new AccountCollisionService(CONFIG);
		users.get("email-user")!.email = "different@example.test";
		await expect(service.resolve("discord-token", "email-token", ACCOUNT_COLLISION_CHOICES.DISCORD)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED});
		expect(KeycloakUtils.deleteUser).not.toHaveBeenCalled();
	});

	it("refuses an incompatible Discord link before deleting the losing account", async () => {
		const service = new AccountCollisionService(CONFIG);
		vi.mocked(KeycloakUtils.getFederatedIdentities).mockResolvedValue({isError: false, status: 200, payload: {identities: [{identityProvider: "discord", userId: "another-discord-id"}]}});
		await expect(service.resolve("email-token", "discord-token", ACCOUNT_COLLISION_CHOICES.EMAIL)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.CONFLICT});
		expect(KeycloakUtils.deleteUser).not.toHaveBeenCalled();
		expect(KeycloakUtils.patchUser).not.toHaveBeenCalled();
	});

	it("refuses a third identity owner before deleting either account", async () => {
		const service = new AccountCollisionService(CONFIG);
		vi.mocked(KeycloakUtils.getDiscordIdentityOwners).mockResolvedValue({isError: false, status: 200, payload: {users: [user("third-user")]}});
		await expect(service.resolve("discord-token", "email-token", ACCOUNT_COLLISION_CHOICES.DISCORD)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.CONFLICT});
		expect(KeycloakUtils.deleteUser).not.toHaveBeenCalled();
	});

	it("retains the confirmed intent after deletion failure and can resume after a service restart", async () => {
		const service = new AccountCollisionService(CONFIG);
		vi.mocked(KeycloakUtils.deleteUser).mockResolvedValueOnce({isError: true, status: 503, payload: {}});
		await expect(service.resolve("discord-token", "email-token", ACCOUNT_COLLISION_CHOICES.DISCORD)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.UNAVAILABLE});
		expect(users.has("email-user")).toBe(true);
		expect(users.get("discord-user")?.attributes.accountCollisionResolution).toBeDefined();
		const restarted = new AccountCollisionService(CONFIG);
		await expect(restarted.check("discord-token")).resolves.toEqual({collision: null, pending: ACCOUNT_COLLISION_CHOICES.DISCORD});
		await expect(restarted.resolve("discord-token", "", ACCOUNT_COLLISION_CHOICES.DISCORD)).resolves.toEqual({kept: ACCOUNT_COLLISION_CHOICES.DISCORD});
		expect(users.has("email-user")).toBe(false);
	});

	it("resumes after the losing identity was deleted but linking was interrupted", async () => {
		const service = new AccountCollisionService(CONFIG);
		vi.mocked(KeycloakUtils.linkDiscordIdentity).mockResolvedValueOnce({isError: true, status: 503, payload: {}});
		await expect(service.resolve("email-token", "discord-token", ACCOUNT_COLLISION_CHOICES.EMAIL)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.CONFLICT});
		expect(users.has("discord-user")).toBe(false);
		await expect(new AccountCollisionService(CONFIG).resolve("email-token", "", ACCOUNT_COLLISION_CHOICES.EMAIL)).resolves.toEqual({kept: ACCOUNT_COLLISION_CHOICES.EMAIL});
		expect(users.get("email-user")?.attributes.discordId).toEqual([DISCORD_ID]);
	});

	it("keeps the selected account discoverable by the bot when Discord linking is interrupted", async () => {
		const service = new AccountCollisionService(CONFIG);
		vi.mocked(KeycloakUtils.linkDiscordIdentity).mockResolvedValueOnce({isError: true, status: 503, payload: {}});
		await expect(service.resolve("email-token", "discord-token", ACCOUNT_COLLISION_CHOICES.EMAIL)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.CONFLICT});
		const botOwners = [...users.values()].filter(account => account.attributes.discordId?.[0] === DISCORD_ID);
		expect(botOwners.map(account => account.id)).toEqual(["email-user"]);
		expect(botOwners[0].attributes.accountCollisionResolution).toBeDefined();
		await expect(new AccountCollisionService(CONFIG).resolve("email-token", "", ACCOUNT_COLLISION_CHOICES.EMAIL)).resolves.toEqual({kept: ACCOUNT_COLLISION_CHOICES.EMAIL});
		expect(users.size).toBe(1);
	});

	it("preserves account fields updated while the Discord identity is being linked", async () => {
		const service = new AccountCollisionService(CONFIG);
		vi.mocked(KeycloakUtils.linkDiscordIdentity).mockImplementationOnce(async () => {
			await KeycloakUtils.patchUser(CONFIG, "email-user", current => ({
				...current,
				attributes: {...current.attributes, gameUsername: ["Updated hero"], language: ["en"]}
			}));
			return {isError: false, status: 204, payload: {changed: true}};
		});
		await expect(service.resolve("email-token", "discord-token", ACCOUNT_COLLISION_CHOICES.EMAIL)).resolves.toEqual({kept: ACCOUNT_COLLISION_CHOICES.EMAIL});
		expect(users.get("email-user")?.attributes.gameUsername).toEqual(["Updated hero"]);
		expect(users.get("email-user")?.attributes.language).toEqual(["en"]);
		expect(users.get("email-user")?.attributes.discordId).toEqual([DISCORD_ID]);
	});

	it("serializes opposite confirmations so they cannot delete both accounts", async () => {
		const service = new AccountCollisionService(CONFIG);
		const results = await Promise.allSettled([
			service.resolve("discord-token", "email-token", ACCOUNT_COLLISION_CHOICES.DISCORD),
			new AccountCollisionService(CONFIG).resolve("email-token", "discord-token", ACCOUNT_COLLISION_CHOICES.EMAIL)
		]);
		expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
		expect(users.size).toBe(1);
		expect(KeycloakUtils.deleteUser).toHaveBeenCalledTimes(1);
	});

	it("can finish a lost response with only the kept session without deleting anything else", async () => {
		await new AccountCollisionService(CONFIG).resolve("email-token", "discord-token", ACCOUNT_COLLISION_CHOICES.EMAIL);
		await expect(new AccountCollisionService(CONFIG).resolve("email-token", "", ACCOUNT_COLLISION_CHOICES.EMAIL)).resolves.toEqual({kept: ACCOUNT_COLLISION_CHOICES.EMAIL});
		expect(KeycloakUtils.deleteUser).toHaveBeenCalledTimes(1);
	});

	it("deletes nothing when only the kept session comes back while both accounts still collide", async () => {
		await expect(new AccountCollisionService(CONFIG).resolve("discord-token", "", ACCOUNT_COLLISION_CHOICES.DISCORD)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED});
		expect(users.size).toBe(2);
		expect(KeycloakUtils.deleteUser).not.toHaveBeenCalled();
		expect(KeycloakUtils.patchUser).not.toHaveBeenCalled();
	});

	it("lets a session opened with the shared address keep its own account alone, which a Discord session never may", async () => {
		const service = new AccountCollisionService(CONFIG);
		await expect(service.resolve("discord-token", "", ACCOUNT_COLLISION_CHOICES.EMAIL)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED});
		await expect(service.resolve("email-token", "", ACCOUNT_COLLISION_CHOICES.DISCORD)).rejects.toMatchObject({reason: ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED});
		expect(users.size).toBe(2);
		await expect(service.resolve("email-token", "", ACCOUNT_COLLISION_CHOICES.EMAIL)).resolves.toEqual({kept: ACCOUNT_COLLISION_CHOICES.EMAIL});
		expect([...users.keys()]).toEqual(["email-user"]);
		expect(users.get("email-user")?.attributes.discordId).toEqual([DISCORD_ID]);
		expect(KeycloakUtils.linkDiscordIdentity).toHaveBeenCalledWith(CONFIG, expect.objectContaining({id: "email-user"}), DISCORD_ID);
	});
});