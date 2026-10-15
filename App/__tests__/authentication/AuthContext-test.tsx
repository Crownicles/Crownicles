import React, {
	ReactElement, useContext, useEffect
} from "react";
import { Text } from "react-native";
import {
	act, render, screen, waitFor
} from "@testing-library/react-native";
import {
	AuthContext, AuthProvider, createSessionStorage
} from "@/src/authentication/AuthContext";
import { AuthStateEnum } from "@/src/authentication/AuthStateEnum";
import {
	AUTH_FAILURES, AuthFailure
} from "@/src/authentication/AuthFailure";
import {
	deleteStoredToken, readFullStoredToken, readStoredToken, TOKEN_STORAGE_KEY_TEMPLATE, writeStoredToken
} from "@/src/authentication/TokenStorage";
import { AuthToken } from "@/src/authentication/AuthToken";
import { WebSocketClient } from "@/src/networking/WebSocketClient";
import { RestApi } from "@/src/networking/RestApi";
import { collectorsStore } from "@/src/collectors/CollectorsStore";
import { reportEventStore } from "@/src/collectors/ReportEventStore";
import { fightStore } from "@/src/store/FightStore";
import { FightIntroductionRes } from "ws-packets/src/fromServer/fight/FightRes";
import { ReportUseTokensAcceptedRes } from "ws-packets/src/fromServer/report/ReportTokenRes";

const mockReset = jest.fn();
const mockReplace = jest.fn();
const mockNavigationRef = {
	isReady: jest.fn((): boolean => true), reset: mockReset
};
jest.mock("expo-router", () => ({
	useRouter: (): object => ({ replace: mockReplace }),
	useNavigationContainerRef: (): object => mockNavigationRef
}));
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("@/src/authentication/TokenStorage", () => ({
	...jest.requireActual<typeof import("@/src/authentication/TokenStorage")>("@/src/authentication/TokenStorage"),
	readFullStoredToken: jest.fn(),
	readStoredToken: jest.fn(),
	deleteStoredToken: jest.fn(),
	writeStoredToken: jest.fn()
}));
jest.mock("@/src/networking/RestApi", () => ({
	...jest.requireActual<typeof import("@/src/networking/RestApi")>("@/src/networking/RestApi"),
	RestApi: { checkAccountCollision: jest.fn() }
}));

let authState: React.ContextType<typeof AuthContext>;
let reportSocket: ((state: AuthStateEnum) => void) | undefined;

function AuthProbe(): ReactElement {
	const context = useContext(AuthContext);
	useEffect(() => {
		authState = context;
	});
	return <Text>{context.state}</Text>;
}

function storedSession(): string {
	return new AuthToken({
		accessToken: "stored-access", refreshToken: "stored-refresh", accessTokenExpiresAt: new Date(Date.now() + 60_000), refreshTokenExpiresAt: "never"
	}).toJsonString();
}

/** Restores a stored session whose socket then opens, as at a cold start. */
async function mountSession(): Promise<void> {
	jest.mocked(readFullStoredToken).mockResolvedValue(storedSession());
	await render(<AuthProvider><AuthProbe /></AuthProvider>);
	await waitFor(() => expect(reportSocket).toBeDefined());
	await act(() => reportSocket!(AuthStateEnum.LOGGED_IN));
	expect(screen.getByText(String(AuthStateEnum.LOGGED_IN))).toBeTruthy();
}

function token(accessToken: string): AuthToken {
	return new AuthToken({
		accessToken, refreshToken: "test-refresh", accessTokenExpiresAt: new Date(Date.now() + 60_000), refreshTokenExpiresAt: "never"
	});
}

describe("account session ownership", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		reportSocket = undefined;
		jest.mocked(readFullStoredToken).mockResolvedValue("");
		jest.mocked(readStoredToken).mockResolvedValue(null);
		jest.mocked(deleteStoredToken).mockResolvedValue(undefined);
		jest.mocked(writeStoredToken).mockResolvedValue(undefined);
		jest.mocked(RestApi.checkAccountCollision).mockResolvedValue({ collision: null });
		jest.spyOn(WebSocketClient.getInstance(), "init").mockImplementation(async (_access, onState) => {
			reportSocket = onState;
		});
		collectorsStore.reset();
		reportEventStore.reset();
		fightStore.reset();
	});
	afterEach(() => {
		collectorsStore.reset();
		jest.restoreAllMocks();
		jest.useRealTimers();
	});

	it.each([AuthStateEnum.NO_TOKEN, AuthStateEnum.TOKEN_INVALID_OR_EXPIRED])("clears old account data and pending navigation when the server ends the session (%s)", async endedState => {
		await mountSession();
		collectorsStore.track({
			id: "old-account-menu",
			endTime: Date.now() + 60_000,
			data: {
				type: "unknown", data: { serverType: "test" }
			},
			reactions: []
		});
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(FightIntroductionRes.wireName, { introduction: {
			fightId: "old-account-fight", initiator: { isSelf: true }, opponent: { isSelf: false }, initiatorActions: [], opponentActions: []
		} });
		registry.dispatch(ReportUseTokensAcceptedRes.wireName, new ReportUseTokensAcceptedRes());
		expect(collectorsStore.getSnapshot()).toHaveLength(1);
		expect(fightStore.getSnapshot().visible).toBe(true);
		expect(reportEventStore.getTokenSnapshot()).not.toBeNull();
		mockReset.mockClear();
		const lateSocket = reportSocket!;
		await act(async () => lateSocket(endedState));
		await act(() => jest.advanceTimersByTime(100));
		expect(screen.getByText(String(endedState))).toBeTruthy();
		expect(collectorsStore.getSnapshot()).toEqual([]);
		expect(fightStore.getSnapshot()).toMatchObject({
			introduction: null, visible: false, logs: []
		});
		expect(reportEventStore.getTokenSnapshot()).toBeNull();
		expect(mockReset).toHaveBeenCalledTimes(1);
		expect(mockReset).toHaveBeenCalledWith({
			index: 0, routes: [{ name: "login" }]
		});
		await act(() => lateSocket(AuthStateEnum.LOGGED_IN));
		expect(screen.getByText(String(endedState))).toBeTruthy();
		expect(collectorsStore.getSnapshot()).toEqual([]);
		expect(fightStore.getSnapshot().visible).toBe(false);
	});

	it("leaves the game alone in the root stack once signed in, so going back cannot reach the login screen", async () => {
		jest.mocked(readFullStoredToken).mockResolvedValue(storedSession());
		await render(<AuthProvider><AuthProbe /></AuthProvider>);
		await waitFor(() => expect(reportSocket).toBeDefined());
		mockReset.mockClear();
		mockNavigationRef.isReady.mockReturnValueOnce(false);
		await act(() => reportSocket!(AuthStateEnum.LOGGED_IN));
		expect(mockReset).not.toHaveBeenCalled();

		await act(() => jest.advanceTimersByTime(100));

		expect(mockReset).toHaveBeenCalledWith({
			index: 0, routes: [{ name: "(protected)" }]
		});
	});

	it("reopens the stored session when the player retries from a connection error", async () => {
		await mountSession();
		await act(async () => reportSocket!(AuthStateEnum.CONNECTION_ERROR));
		expect(screen.getByText(String(AuthStateEnum.CONNECTION_ERROR))).toBeTruthy();
		await act(async () => authState.retry());
		await waitFor(() => expect(WebSocketClient.getInstance().init).toHaveBeenCalledTimes(2));
		expect(mockReplace).toHaveBeenCalledWith("/");
		expect(readFullStoredToken).toHaveBeenCalledTimes(2);
	});

	it("signs in again instead of reconnecting forever when the stored session is unreadable", async () => {
		jest.mocked(readFullStoredToken).mockResolvedValue("{\"accessToken\":\"interrupted-wri");
		await render(<AuthProvider><AuthProbe /></AuthProvider>);
		await waitFor(() => expect(screen.getByText(String(AuthStateEnum.TOKEN_INVALID_OR_EXPIRED))).toBeTruthy());
		expect(WebSocketClient.getInstance().init).not.toHaveBeenCalled();
		expect(mockReset).toHaveBeenCalledWith({
			index: 0, routes: [{ name: "login" }]
		});
	});

	// Without a navigator under it, a root navigation remounts the whole app, boot screen included.
	it("never moves the root once unmounted, even when the session it was opening is refused afterwards", async () => {
		let refuse: (error: Error) => void = () => undefined;
		jest.mocked(readFullStoredToken).mockResolvedValue(storedSession());
		jest.mocked(RestApi.checkAccountCollision).mockReturnValue(new Promise((_resolve, reject) => {
			refuse = reject;
		}));
		await render(<AuthProvider><AuthProbe /></AuthProvider>);
		await waitFor(() => expect(RestApi.checkAccountCollision).toHaveBeenCalled());
		mockReset.mockClear();
		mockReplace.mockClear();

		await screen.unmount();
		await act(async () => refuse(new AuthFailure(AUTH_FAILURES.INVALID_TOKEN, "refused after the boot screen took over")));
		await act(() => jest.advanceTimersByTime(1_000));

		expect(mockReset).not.toHaveBeenCalled();
		expect(mockReplace).not.toHaveBeenCalled();
	});
});

describe("session storage", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.mocked(readStoredToken).mockResolvedValue(null);
		jest.mocked(deleteStoredToken).mockResolvedValue(undefined);
		jest.mocked(writeStoredToken).mockResolvedValue(undefined);
	});

	it("deletes all token parts before resolving session cleanup", async () => {
		jest.mocked(readStoredToken).mockResolvedValueOnce("first-part")
			.mockResolvedValueOnce("second-part")
			.mockResolvedValueOnce(null);
		await createSessionStorage().clear();
		expect(deleteStoredToken).toHaveBeenCalledTimes(2);
		expect(deleteStoredToken).toHaveBeenNthCalledWith(1, `${TOKEN_STORAGE_KEY_TEMPLATE}1`);
		expect(deleteStoredToken).toHaveBeenNthCalledWith(2, `${TOKEN_STORAGE_KEY_TEMPLATE}2`);
	});

	it("rejects cleanup when the keychain cannot delete the previous account's token", async () => {
		jest.mocked(readStoredToken).mockResolvedValueOnce("previous-token");
		jest.mocked(deleteStoredToken).mockRejectedValueOnce(new Error("keychain unavailable"));
		await expect(createSessionStorage().clear()).rejects.toThrow("keychain unavailable");
	});

	it("rejects a new session whose token cannot be written to the keychain", async () => {
		jest.mocked(writeStoredToken).mockRejectedValueOnce(new Error("keychain unavailable"));
		await expect(createSessionStorage().save(token("test-access"))).rejects.toThrow("keychain unavailable");
	});

	it("splits a long session into keychain parts that read back as the same session", async () => {
		const stored = new Map<string, string>();
		jest.mocked(writeStoredToken).mockImplementation(async (key, value) => {
			stored.set(key, value);
		});
		const long = token("a".repeat(3000));
		await createSessionStorage().save(long);
		expect(stored.size).toBe(2);
		jest.mocked(readFullStoredToken).mockResolvedValue([...stored.values()].join(""));
		const restored = await createSessionStorage().read();
		expect(restored?.getAccessToken()).toBe("a".repeat(3000));
	});

	it("reads a session interrupted between two keychain parts as one to sign in again", async () => {
		jest.mocked(readFullStoredToken).mockResolvedValue("{\"accessToken\":\"interrupted-wri");
		await expect(createSessionStorage().read()).rejects.toMatchObject({ reason: AUTH_FAILURES.INVALID_TOKEN });
	});

	it("finishes an already-started token write before deleting the previous account's stored session", async () => {
		const stored = new Map<string, string>();
		let finishWrite!: () => void;
		const writePending = new Promise<void>(resolve => {
			finishWrite = resolve;
		});
		jest.mocked(readStoredToken).mockImplementation(async key => stored.get(key) ?? null);
		jest.mocked(deleteStoredToken).mockImplementation(async key => {
			stored.delete(key);
		});
		jest.mocked(writeStoredToken).mockImplementation(async (key, value) => {
			await writePending;
			stored.set(key, value);
		});
		const storage = createSessionStorage();
		const saving = storage.save(token("test-access"));
		await waitFor(() => expect(writeStoredToken).toHaveBeenCalledTimes(1));
		const clearing = storage.clear();
		finishWrite();
		await Promise.all([saving, clearing]);
		expect(stored.size).toBe(0);
	});
});
