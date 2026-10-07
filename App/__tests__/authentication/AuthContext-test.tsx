import React, {ReactElement, useContext} from "react";
import {Text} from "react-native";
import {act, render, screen, waitFor} from "@testing-library/react-native";
import {AuthContext, AuthProvider} from "@/src/authentication/AuthContext";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {deleteStoredToken, readFullStoredToken, readStoredToken, TOKEN_STORAGE_KEY_TEMPLATE, writeStoredToken} from "@/src/authentication/TokenStorage";
import {AuthToken} from "@/src/authentication/AuthToken";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {collectorsStore} from "@/src/collectors/CollectorsStore";
import {reportEventStore} from "@/src/collectors/ReportEventStore";
import {fightStore} from "@/src/store/FightStore";
import {FightIntroductionRes} from "ws-packets/src/fromServer/fight/FightRes";
import {ReportUseTokensAcceptedRes} from "ws-packets/src/fromServer/report/ReportTokenRes";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({useRouter: (): object => ({replace: mockReplace})}));
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("@/src/authentication/TokenStorage", () => ({
	...jest.requireActual<typeof import("@/src/authentication/TokenStorage")>("@/src/authentication/TokenStorage"),
	readFullStoredToken: jest.fn(),
	readStoredToken: jest.fn(),
	deleteStoredToken: jest.fn(),
	writeStoredToken: jest.fn()
}));

let authState: React.ContextType<typeof AuthContext>;

function AuthProbe(): ReactElement {
	authState = useContext(AuthContext);
	return <Text>{authState.state}</Text>;
}

async function mountSession(): Promise<void> {
	await render(<AuthProvider><AuthProbe /></AuthProvider>);
	await waitFor(() => expect(screen.getByText(String(AuthStateEnum.NO_TOKEN))).toBeTruthy());
	await act(() => authState.setState(AuthStateEnum.LOGGED_IN));
}

describe("account session ownership", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		jest.mocked(readFullStoredToken).mockResolvedValue("");
		jest.mocked(readStoredToken).mockResolvedValue(null);
		jest.mocked(deleteStoredToken).mockResolvedValue(undefined);
		jest.mocked(writeStoredToken).mockResolvedValue(undefined);
		collectorsStore.reset();
		reportEventStore.reset();
		fightStore.reset();
	});
	afterEach(() => {
		collectorsStore.reset();
		jest.useRealTimers();
	});

	it.each([AuthStateEnum.NO_TOKEN, AuthStateEnum.TOKEN_INVALID_OR_EXPIRED])("clears old account data and pending navigation when the session ends (%s)", async endedState => {
		await mountSession();
		collectorsStore.track({id: "old-account-menu", endTime: Date.now() + 60_000, data: {type: "unknown", data: {serverType: "test"}}, reactions: []});
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(FightIntroductionRes.wireName, {introduction: {fightId: "old-account-fight", initiator: {isSelf: true}, opponent: {isSelf: false}, initiatorActions: [], opponentActions: []}});
		registry.dispatch(ReportUseTokensAcceptedRes.wireName, new ReportUseTokensAcceptedRes());
		expect(collectorsStore.getSnapshot()).toHaveLength(1);
		expect(fightStore.getSnapshot().visible).toBe(true);
		expect(reportEventStore.getTokenSnapshot()).not.toBeNull();
		mockReplace.mockClear();
		await act(() => authState.setState(endedState));
		await act(() => jest.advanceTimersByTime(100));
		expect(collectorsStore.getSnapshot()).toEqual([]);
		expect(fightStore.getSnapshot()).toMatchObject({introduction: null, visible: false, logs: []});
		expect(reportEventStore.getTokenSnapshot()).toBeNull();
		expect(mockReplace).toHaveBeenCalledWith("/login");
		expect(mockReplace).not.toHaveBeenCalledWith("/");
		await act(() => authState.setState(AuthStateEnum.LOGGED_IN));
		expect(collectorsStore.getSnapshot()).toEqual([]);
		expect(fightStore.getSnapshot().visible).toBe(false);
	});

	it("deletes all token parts before resolving session cleanup", async () => {
		await mountSession();
		jest.mocked(readStoredToken).mockResolvedValueOnce("first-part").mockResolvedValueOnce("second-part").mockResolvedValueOnce(null);
		await authState.clearToken();
		expect(deleteStoredToken).toHaveBeenCalledTimes(2);
		expect(deleteStoredToken).toHaveBeenNthCalledWith(1, `${TOKEN_STORAGE_KEY_TEMPLATE}1`);
		expect(deleteStoredToken).toHaveBeenNthCalledWith(2, `${TOKEN_STORAGE_KEY_TEMPLATE}2`);
	});

	it("rejects cleanup when the keychain cannot delete the previous account's token", async () => {
		await mountSession();
		jest.mocked(readStoredToken).mockResolvedValueOnce("previous-token");
		jest.mocked(deleteStoredToken).mockRejectedValueOnce(new Error("keychain unavailable"));
		await expect(authState.clearToken()).rejects.toThrow("keychain unavailable");
	});

	it("rejects a new session whose token cannot be written to the keychain", async () => {
		await mountSession();
		jest.mocked(writeStoredToken).mockRejectedValueOnce(new Error("keychain unavailable"));
		const token = new AuthToken({accessToken: "test-access", refreshToken: "test-refresh", accessTokenExpiresAt: new Date(Date.now() + 60_000), refreshTokenExpiresAt: "never"});
		await expect(authState.saveToken(token)).rejects.toThrow("keychain unavailable");
	});

	it("finishes an already-started token write before deleting the previous account's stored session", async () => {
		await mountSession();
		const stored = new Map<string, string>();
		let finishWrite!: () => void;
		const writePending = new Promise<void>(resolve => { finishWrite = resolve; });
		jest.mocked(readStoredToken).mockImplementation(async key => stored.get(key) ?? null);
		jest.mocked(deleteStoredToken).mockImplementation(async key => { stored.delete(key); });
		jest.mocked(writeStoredToken).mockImplementation(async (key, value) => {
			await writePending;
			stored.set(key, value);
		});
		const token = new AuthToken({accessToken: "test-access", refreshToken: "test-refresh", accessTokenExpiresAt: new Date(Date.now() + 60_000), refreshTokenExpiresAt: "never"});
		const saving = authState.saveToken(token);
		await waitFor(() => expect(writeStoredToken).toHaveBeenCalledTimes(1));
		const clearing = authState.clearToken();
		finishWrite();
		await Promise.all([saving, clearing]);
		expect(stored.size).toBe(0);
	});
});