import {
	act, fireEvent, render, screen, waitFor
} from "@testing-library/react-native";
import React from "react";
import LoginScreen from "@/app/login";
import {AuthContext} from "@/src/authentication/AuthContext";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {KeycloakAuth} from "@/src/authentication/KeycloakAuth";
import {KeycloakOAuth2Token} from "@/src/authentication/KeycloakOAuth2Token";
import {
	AUTH_FAILURES, AuthFailure
} from "@/src/authentication/AuthFailure";

const mockInit = jest.fn().mockResolvedValue(undefined);
const mockSaveToken = jest.fn().mockResolvedValue(undefined);
const mockClearToken = jest.fn().mockResolvedValue(undefined);
jest.mock("@/src/networking/RestApi", () => ({RestApi: {checkAccountCollision: jest.fn(() => Promise.resolve({collision: null}))}}));

jest.mock("expo-router", () => ({useRouter: (): object => ({replace: jest.fn()})}));
jest.mock("@/src/authentication/TokenStorage", () => ({
	readStoredToken: jest.fn().mockResolvedValue(null),
	writeStoredToken: jest.fn().mockResolvedValue(undefined),
	deleteStoredToken: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("@/src/authentication/KeycloakAuth", () => ({
	IDENTITY_PROVIDERS: {DISCORD: "discord"},
	KeycloakAuth: {login: jest.fn(), register: jest.fn()}
}));
jest.mock("@/src/networking/WebSocketClient", () => ({WebSocketClient: {getInstance: (): object => ({init: mockInit, registerPushedPacketHandler: (): () => void => (): void => undefined})}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

async function renderLogin(state: AuthStateEnum = AuthStateEnum.NO_TOKEN): Promise<void> {
	const value: React.ContextType<typeof AuthContext> = {
		state,
		setState: jest.fn(),
		saveToken: mockSaveToken,
		clearToken: mockClearToken
	};

	await render(<AuthContext.Provider value={value}><LoginScreen /></AuthContext.Provider>);
}

describe("login screen", () => {
	beforeEach((): void => {
		jest.clearAllMocks();
		mockSaveToken.mockResolvedValue(undefined);
		mockClearToken.mockResolvedValue(undefined);
		jest.mocked(KeycloakAuth.login).mockRejectedValue(new AuthFailure(AUTH_FAILURES.CANCELLED, "dismiss"));
	});

	it("asks about the existing Discord adventure before offering registration", async () => {
		await renderLogin();
		expect(screen.getByText("app:auth.alreadyOnDiscord")).toBeTruthy();
		expect(screen.queryByText("app:auth.createAccount")).toBeNull();
		expect(KeycloakAuth.login).not.toHaveBeenCalled();
		expect(KeycloakAuth.register).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:auth.existingDiscord"));
		expect(screen.getByText("app:auth.withDiscord")).toBeTruthy();
		expect(screen.queryByText("app:auth.withAccount")).toBeNull();
		expect(screen.queryByText("app:auth.createAccount")).toBeNull();
	});

	it("allows correcting the entry choice without opening authentication", async () => {
		await renderLogin();
		await fireEvent.press(screen.getByText("app:auth.withoutDiscord"));
		expect(screen.getByText("app:auth.createAccount")).toBeTruthy();
		await fireEvent.press(screen.getByText("app:common.back"));
		expect(screen.getByText("app:auth.alreadyOnDiscord")).toBeTruthy();
		expect(screen.queryByText("app:auth.createAccount")).toBeNull();
		expect(KeycloakAuth.login).not.toHaveBeenCalled();
		expect(KeycloakAuth.register).not.toHaveBeenCalled();
	});

	it("sends the Discord way straight to its provider, skipping the Keycloak picker", async () => {
		await renderLogin();
		await fireEvent.press(screen.getByText("app:auth.existingDiscord"));

		await waitFor(() => expect(KeycloakAuth.login).toHaveBeenCalledWith("discord"));
		expect(KeycloakAuth.login).toHaveBeenCalledTimes(1);
	});

	it("leaves the choice to Keycloak for a Crownicles account", async () => {
		await renderLogin();
		await fireEvent.press(screen.getByText("app:auth.withoutDiscord"));

		await fireEvent.press(screen.getByText("app:auth.withAccount"));
		await waitFor(() => expect(KeycloakAuth.login).toHaveBeenCalledWith());
	});

	it("creates the account on the Keycloak page, then signs the player in", async () => {
		jest.mocked(KeycloakAuth.register).mockRejectedValue(new AuthFailure(AUTH_FAILURES.CANCELLED, "dismiss"));
		await renderLogin();
		await fireEvent.press(screen.getByText("app:auth.withoutDiscord"));

		await fireEvent.press(screen.getByText("app:auth.createAccount"));
		await waitFor(() => expect(KeycloakAuth.register).toHaveBeenCalled());
		expect(KeycloakAuth.login).not.toHaveBeenCalled();
	});

	it("says nothing when the player backs out of the browser", async () => {
		await renderLogin();
		await fireEvent.press(screen.getByText("app:auth.existingDiscord"));

		await waitFor(() => expect(KeycloakAuth.login).toHaveBeenCalled());
		expect(screen.queryByText(/app:auth\.loginFailed/)).toBeNull();
	});

	it("explains a refusal in the player's words, never the protocol's", async () => {
		jest.mocked(KeycloakAuth.login).mockRejectedValue(new AuthFailure(AUTH_FAILURES.DENIED, "The user denied the request"));
		await renderLogin();
		await fireEvent.press(screen.getByText("app:auth.existingDiscord"));

		await waitFor(() => expect(screen.getByText("app:auth.failures.denied")).toBeTruthy());
		expect(screen.getByText("app:auth.loginFailed")).toBeTruthy();
	});

	it("does not start a second authorization while the browser is already opening", async () => {
		let cancel!: (error: AuthFailure) => void;
		const pending = new Promise<KeycloakOAuth2Token>((_resolve, reject) => { cancel = reject; });
		jest.mocked(KeycloakAuth.login).mockReturnValueOnce(pending);
		await renderLogin();
		await fireEvent.press(screen.getByText("app:auth.existingDiscord"));
		await fireEvent.press(screen.getByRole("button", {name: "app:auth.connecting"}));
		expect(KeycloakAuth.login).toHaveBeenCalledTimes(1);
		await act(async (): Promise<void> => { cancel(new AuthFailure(AUTH_FAILURES.CANCELLED, "dismiss")); });
		expect(screen.getByText("app:auth.withDiscord")).toBeTruthy();
		expect(screen.queryByText("app:auth.loginFailed")).toBeNull();
	});

	it("waits until the old token is replaced before opening the new account's socket", async () => {
		let saved!: () => void;
		mockSaveToken.mockReturnValueOnce(new Promise<void>(resolve => { saved = resolve; }));
		jest.mocked(KeycloakAuth.login).mockResolvedValueOnce({access_token: "test-access", refresh_token: "test-refresh", expires_in: 300, refresh_expires_in: 0, token_type: "Bearer", session_state: "test-session", scope: "openid"});
		await renderLogin();
		await fireEvent.press(screen.getByText("app:auth.existingDiscord"));
		await waitFor(() => expect(mockSaveToken).toHaveBeenCalledTimes(1));
		expect(mockInit).not.toHaveBeenCalled();
		await act(async (): Promise<void> => { saved(); });
		await waitFor(() => expect(mockInit).toHaveBeenCalledTimes(1));
	});

	it("never opens the next account's socket when its token cannot be stored", async () => {
		mockSaveToken.mockRejectedValueOnce(new Error("keychain unavailable"));
		jest.mocked(KeycloakAuth.login).mockResolvedValueOnce({access_token: "test-access", refresh_token: "test-refresh", expires_in: 300, refresh_expires_in: 0, token_type: "Bearer", session_state: "test-session", scope: "openid"});
		await renderLogin();
		await fireEvent.press(screen.getByText("app:auth.existingDiscord"));
		await waitFor(() => expect(screen.getByText("app:auth.loginFailed")).toBeTruthy());
		expect(mockInit).not.toHaveBeenCalled();
	});
});
