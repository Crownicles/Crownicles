import { SessionCoordinator } from "@/src/authentication/SessionCoordinator";
import { AuthToken } from "@/src/authentication/AuthToken";
import { AuthStateEnum } from "@/src/authentication/AuthStateEnum";
import { RestApi, AppIncompatibilityFailure } from "@/src/networking/RestApi";
import { AUTH_FAILURES, AuthFailure } from "@/src/authentication/AuthFailure";
import { ACCOUNT_ACTION_OUTCOMES, KeycloakAuth } from "@/src/authentication/KeycloakAuth";
import { ACCOUNT_COLLISION_CHOICES, AccountCollisionCheck } from "ws-packets/src/objects/AccountCollision";
import { APP_COMPATIBILITY_STATUSES } from "ws-packets/src/AppCompatibility";

jest.mock("@/src/networking/RestApi", () => ({
	AppIncompatibilityFailure: jest.requireActual<typeof import("@/src/networking/RestApi")>("@/src/networking/RestApi").AppIncompatibilityFailure,
	isAccountCollisionOpen: (check: {collision: unknown; pending?: string}): boolean => Boolean(check.collision || check.pending),
	RestApi: {checkAccountCollision: jest.fn()}
}));

function token(accessToken = "session-access"): AuthToken {
	return new AuthToken({accessToken, refreshToken: `${accessToken}-refresh`, accessTokenExpiresAt: new Date(Date.now() + 60_000), refreshTokenExpiresAt: "never"});
}

const COLLISION: AccountCollisionCheck = {
	collision: {
		email: "same@example.test",
		discord: {name: "Discord hero", createdAt: 0},
		emailAccount: {keycloakId: "email-id", name: "Email hero", createdAt: 0}
	},
	current: ACCOUNT_COLLISION_CHOICES.DISCORD
};

type Harness = {
	session: SessionCoordinator;
	storage: {read: jest.Mock; save: jest.Mock; clear: jest.Mock};
	socket: {open: jest.Mock; close: jest.Mock};
	events: {state: jest.Mock; collision: jest.Mock};

	/** Speaks as the socket opened last for the session. */
	report: (state: AuthStateEnum) => void;
};

function harness(stored: AuthToken | null = null): Harness {
	const storage = {read: jest.fn().mockResolvedValue(stored), save: jest.fn().mockResolvedValue(undefined), clear: jest.fn().mockResolvedValue(undefined)};
	const socket = {open: jest.fn().mockResolvedValue(undefined), close: jest.fn()};
	const events = {state: jest.fn(), collision: jest.fn()};
	return {
		session: new SessionCoordinator(storage, socket, events), storage, socket, events,
		report: state => (socket.open.mock.calls.at(-1)![1] as (reported: AuthStateEnum) => void)(state)
	};
}

function flush(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, 0));
}

describe("session coordinator", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.mocked(RestApi.checkAccountCollision).mockResolvedValue({collision: null});
	});
	afterEach(() => jest.restoreAllMocks());

	it("uses the same admission path for a login and a restored session", async () => {
		const current = token();
		const {session, socket} = harness(current);
		await session.restore();
		await session.enter(current);
		expect(socket.open).toHaveBeenCalledTimes(2);
		expect(RestApi.checkAccountCollision).toHaveBeenCalledTimes(2);
	});

	it("keeps the stored session on a temporary admission failure", async () => {
		const {session, storage, socket, events} = harness(token());
		jest.mocked(RestApi.checkAccountCollision).mockRejectedValue(new TypeError("Network unavailable"));
		await session.restore();
		expect(storage.clear).not.toHaveBeenCalled();
		expect(socket.open).not.toHaveBeenCalled();
		expect(events.state).toHaveBeenLastCalledWith(AuthStateEnum.CONNECTION_ERROR);
	});

	it.each([
		{status: APP_COMPATIBILITY_STATUSES.APP_OUTDATED, state: AuthStateEnum.APP_OUTDATED},
		{status: APP_COMPATIBILITY_STATUSES.SERVER_OUTDATED, state: AuthStateEnum.SERVER_OUTDATED}
	])("keeps the session waiting for the side behind when the protocols part ($status)", async ({status, state}) => {
		const {session, storage, socket, events} = harness(token());
		jest.mocked(RestApi.checkAccountCollision).mockRejectedValueOnce(new AppIncompatibilityFailure(status));
		await session.restore();
		expect(events.state).toHaveBeenLastCalledWith(state);
		expect(storage.clear).not.toHaveBeenCalled();
		expect(socket.open).not.toHaveBeenCalled();
		await session.restore();
		expect(socket.open).toHaveBeenCalledTimes(1);
	});

	it("sends a stored session the device can no longer read back to sign-in, instead of a dead end", async () => {
		const {session, storage, socket, events} = harness();
		storage.read.mockRejectedValue(new AuthFailure(AUTH_FAILURES.INVALID_TOKEN, "Invalid token string format"));
		await session.restore();
		expect(storage.clear).toHaveBeenCalledTimes(1);
		expect(socket.open).not.toHaveBeenCalled();
		expect(events.state).toHaveBeenLastCalledWith(AuthStateEnum.TOKEN_INVALID_OR_EXPIRED);
	});

	it("lets the player leave a keychain it cannot read, even when it cannot erase it either", async () => {
		const {session, storage, events} = harness();
		jest.spyOn(console, "warn").mockImplementation(() => undefined);
		storage.read.mockRejectedValue(new Error("keychain unavailable"));
		storage.clear.mockRejectedValue(new Error("keychain unavailable"));
		await session.restore();
		expect(events.state).toHaveBeenLastCalledWith(AuthStateEnum.CONNECTION_ERROR);
		expect(storage.clear).not.toHaveBeenCalled();
		await session.leave();
		expect(events.state).toHaveBeenLastCalledWith(AuthStateEnum.NO_TOKEN);
	});

	it("never opens the socket when secure session persistence fails", async () => {
		const {session, storage, socket} = harness();
		storage.save.mockRejectedValue(new Error("keychain unavailable"));
		await expect(session.enter(token())).rejects.toThrow("keychain unavailable");
		expect(socket.open).not.toHaveBeenCalled();
	});

	it("does not reopen a session after logout while admission is pending", async () => {
		let finish!: (check: {collision: null}) => void;
		const {session, socket, events} = harness(token());
		jest.mocked(RestApi.checkAccountCollision).mockReturnValue(new Promise(resolve => {finish = resolve;}));
		const restoring = session.restore();
		while (!finish) {
			await Promise.resolve();
		}
		await session.leave();
		finish({collision: null});
		await restoring;
		expect(socket.open).not.toHaveBeenCalled();
		expect(events.state).toHaveBeenLastCalledWith(AuthStateEnum.NO_TOKEN);
	});

	it("shares token rotation and retries persistence before exposing a rotated access token", async () => {
		const current = token();
		const {session, storage} = harness();
		await session.enter(current);
		jest.spyOn(current, "getAccessToken").mockReturnValue("rotated-access");
		jest.spyOn(current, "toJsonString").mockReturnValue("rotated-session");
		storage.save.mockRejectedValueOnce(new Error("keychain unavailable"));
		const first = session.accessToken();
		expect(session.accessToken()).toBe(first);
		await expect(first).rejects.toThrow("keychain unavailable");
		await expect(session.accessToken()).resolves.toBe("rotated-access");
		expect(storage.save).toHaveBeenCalledTimes(3);
	});

	it("persists a token rotated by a collision flow before reusing its access", async () => {
		jest.useFakeTimers();
		try {
			const current = token();
			const saved: string[] = [];
			const {session, storage} = harness();
			storage.save.mockImplementation(async (tokenToSave: AuthToken) => {saved.push(tokenToSave.toJsonString());});
			await session.enter(current);
			jest.spyOn(KeycloakAuth, "refresh").mockResolvedValue({access_token: "rotated-access", refresh_token: "rotated-refresh", expires_in: 300, refresh_expires_in: 0, token_type: "Bearer", session_state: "session", scope: "openid offline_access"});
			jest.advanceTimersByTime(61_000);
			await current.refreshIfNeeded();
			await expect(session.accessToken()).resolves.toBe("rotated-access");
			expect(saved).toHaveLength(2);
			expect(saved[0]).not.toBe(saved[1]);
			expect(AuthToken.fromJsonString(saved[1]).getAccessToken()).toBe("rotated-access");
		}
		finally {
			jest.useRealTimers();
		}
	});

	it("does not reuse a refresh from the previous account", async () => {
		const previous = token();
		const {session} = harness();
		await session.enter(previous);
		let finish!: (refreshed: boolean) => void;
		jest.spyOn(previous, "refreshIfNeeded").mockReturnValue(new Promise(resolve => {finish = resolve;}));
		const stale = session.accessToken();
		await session.enter(token("new-account"));
		await expect(session.accessToken()).resolves.toBe("new-account");
		finish(true);
		await expect(stale).resolves.toBeNull();
	});

	it("clears permanently rejected tokens without opening a socket", async () => {
		const current = token();
		jest.spyOn(current, "refreshIfNeeded").mockRejectedValue(new AuthFailure(AUTH_FAILURES.INVALID_TOKEN, "refresh rejected"));
		const {session, storage, socket, events} = harness(current);
		await session.restore();
		expect(socket.open).not.toHaveBeenCalled();
		expect(storage.clear).toHaveBeenCalledTimes(1);
		expect(events.state).toHaveBeenLastCalledWith(AuthStateEnum.TOKEN_INVALID_OR_EXPIRED);
	});

	it("keeps an open session when another screen cannot refresh its access for a while", async () => {
		const current = token();
		const {session, socket, events, report} = harness();
		await session.enter(current);
		report(AuthStateEnum.LOGGED_IN);
		const closes = socket.close.mock.calls.length;
		jest.spyOn(current, "refreshIfNeeded").mockRejectedValue(new TypeError("Network unavailable"));
		await expect(session.accessToken()).rejects.toThrow("Network unavailable");
		expect(events.state).toHaveBeenLastCalledWith(AuthStateEnum.LOGGED_IN);
		expect(socket.close).toHaveBeenCalledTimes(closes);
	});

	it("ends the session wherever Keycloak refuses its refresh", async () => {
		const current = token();
		const {session, storage, socket, events, report} = harness();
		await session.enter(current);
		report(AuthStateEnum.LOGGED_IN);
		const closes = socket.close.mock.calls.length;
		jest.spyOn(current, "refreshIfNeeded").mockRejectedValue(new AuthFailure(AUTH_FAILURES.INVALID_TOKEN, "refresh rejected"));
		await expect(session.accessToken()).rejects.toMatchObject({reason: AUTH_FAILURES.INVALID_TOKEN});
		expect(storage.clear).toHaveBeenCalledTimes(1);
		expect(socket.close).toHaveBeenCalledTimes(closes + 1);
		expect(events.state).toHaveBeenLastCalledWith(AuthStateEnum.TOKEN_INVALID_OR_EXPIRED);
	});

	it("applies an end decided by the server even when the device cannot erase the session", async () => {
		const {session, storage, events, report} = harness();
		jest.spyOn(console, "warn").mockImplementation(() => undefined);
		await session.enter(token());
		report(AuthStateEnum.LOGGED_IN);
		storage.clear.mockRejectedValue(new Error("keychain unavailable"));
		report(AuthStateEnum.NO_TOKEN);
		await flush();
		expect(events.state).toHaveBeenLastCalledWith(AuthStateEnum.NO_TOKEN);
	});

	it("keeps an open session running when the device cannot forget it, so leaving can be retried", async () => {
		const {session, storage, socket, events, report} = harness();
		await session.enter(token());
		report(AuthStateEnum.LOGGED_IN);
		const closes = socket.close.mock.calls.length;
		storage.clear.mockRejectedValueOnce(new Error("keychain unavailable"));
		await expect(session.leave()).rejects.toThrow("keychain unavailable");
		expect(socket.close).toHaveBeenCalledTimes(closes);
		expect(events.state).toHaveBeenLastCalledWith(AuthStateEnum.LOGGED_IN);
		await session.leave();
		expect(socket.close).toHaveBeenCalledTimes(closes + 1);
		expect(events.state).toHaveBeenLastCalledWith(AuthStateEnum.NO_TOKEN);
	});

	it("does not save a rotated token while the device is forgetting the session", async () => {
		const current = token();
		const {session, storage, report} = harness();
		await session.enter(current);
		report(AuthStateEnum.LOGGED_IN);
		let forget!: () => void;
		storage.clear.mockReturnValueOnce(new Promise<void>(resolve => {forget = resolve;}));
		const leaving = session.leave();
		jest.spyOn(current, "toJsonString").mockReturnValue("rotated-session");
		await expect(session.accessToken()).resolves.toBe("session-access");
		expect(storage.save).toHaveBeenCalledTimes(1);
		forget();
		await leaving;
	});

	it("ignores what the socket of a session that was left still reports", async () => {
		const {session, events, report} = harness();
		await session.enter(token());
		await session.leave();
		report(AuthStateEnum.LOGGED_IN);
		expect(events.state).toHaveBeenLastCalledWith(AuthStateEnum.NO_TOKEN);
	});

	it("checks the same account again when its socket reports a collision", async () => {
		const {session, events, report} = harness();
		await session.enter(token());
		jest.mocked(RestApi.checkAccountCollision).mockResolvedValueOnce(COLLISION);
		report(AuthStateEnum.ACCOUNT_COLLISION);
		await flush();
		expect(RestApi.checkAccountCollision).toHaveBeenLastCalledWith("session-access");
		expect(events.collision).toHaveBeenLastCalledWith(expect.objectContaining({check: COLLISION}));
		expect(events.state).toHaveBeenLastCalledWith(AuthStateEnum.ACCOUNT_COLLISION);
	});

	it("makes the account kept in a collision the session this device restores", async () => {
		const {session, storage, events} = harness();
		jest.mocked(RestApi.checkAccountCollision).mockResolvedValueOnce(COLLISION);
		await session.enter(token("discord-access"));
		expect(events.state).toHaveBeenLastCalledWith(AuthStateEnum.ACCOUNT_COLLISION);
		const kept = token("email-access");
		await session.checkpoint(kept);
		expect(storage.save).toHaveBeenLastCalledWith(kept);
		await expect(session.accessToken()).resolves.toBe("email-access");
	});

	it("never lets a collision choice replace an open session", async () => {
		const {session, storage} = harness();
		await session.enter(token());
		await expect(session.checkpoint(token("other-access"))).rejects.toThrow();
		expect(storage.save).toHaveBeenCalledTimes(1);
	});

	it.each(["changeEmail", "changePassword"] as const)("targets %s at the current authenticated account", async action => {
		const {session} = harness();
		await session.enter(token());
		const target = {keycloakId: "current-sub", loginHint: "current@example.com"};
		jest.spyOn(KeycloakAuth, "accountIdentity").mockResolvedValue(target);
		const browserAction = jest.spyOn(KeycloakAuth, action).mockResolvedValue(ACCOUNT_ACTION_OUTCOMES.PENDING);
		await session[action]();
		expect(KeycloakAuth.accountIdentity).toHaveBeenCalledWith("session-access");
		expect(browserAction).toHaveBeenCalledWith(target);
	});

	it("does not open a sensitive action after logout while identity is pending", async () => {
		const {session} = harness();
		await session.enter(token());
		let finish!: (identity: {keycloakId: string}) => void;
		jest.spyOn(KeycloakAuth, "accountIdentity").mockImplementation(() => new Promise(resolve => {finish = resolve;}));
		const action = jest.spyOn(KeycloakAuth, "changeEmail");
		const pending = session.changeEmail();
		while (!finish) {
			await Promise.resolve();
		}
		await session.leave();
		finish({keycloakId: "old-sub"});
		await expect(pending).resolves.toBe(ACCOUNT_ACTION_OUTCOMES.CANCELLED);
		expect(action).not.toHaveBeenCalled();
	});
});