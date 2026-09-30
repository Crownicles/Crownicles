import {
	fireEvent, render, screen, waitFor
} from "@testing-library/react-native";
import React from "react";
import LoginScreen from "@/app/login";
import {AuthContext} from "@/src/authentication/AuthContext";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {KeycloakAuth} from "@/src/authentication/KeycloakAuth";
import {
	AUTH_FAILURES, AuthFailure
} from "@/src/authentication/AuthFailure";

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
jest.mock("@/src/networking/WebSocketClient", () => ({WebSocketClient: {getInstance: (): object => ({init: jest.fn().mockResolvedValue(undefined)})}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string): string => key}}));

async function renderLogin(): Promise<void> {
	const value = {
		state: AuthStateEnum.NO_TOKEN,
		setState: jest.fn(),
		saveToken: jest.fn().mockResolvedValue(undefined),
		clearToken: jest.fn().mockResolvedValue(undefined)
	} as unknown as React.ContextType<typeof AuthContext>;

	await render(<AuthContext.Provider value={value}><LoginScreen /></AuthContext.Provider>);
}

describe("login screen", () => {
	beforeEach((): void => {
		jest.clearAllMocks();
		jest.mocked(KeycloakAuth.login).mockRejectedValue(new AuthFailure(AUTH_FAILURES.CANCELLED, "dismiss"));
	});

	it("sends the Discord way straight to its provider, skipping the Keycloak picker", async () => {
		await renderLogin();

		await fireEvent.press(screen.getByText("app:auth.withDiscord"));
		await waitFor(() => expect(KeycloakAuth.login).toHaveBeenCalledWith("discord"));
	});

	it("leaves the choice to Keycloak for a Crownicles account", async () => {
		await renderLogin();

		await fireEvent.press(screen.getByText("app:auth.withAccount"));
		await waitFor(() => expect(KeycloakAuth.login).toHaveBeenCalledWith());
	});

	it("creates the account on the Keycloak page, then signs the player in", async () => {
		jest.mocked(KeycloakAuth.register).mockRejectedValue(new AuthFailure(AUTH_FAILURES.CANCELLED, "dismiss"));
		await renderLogin();

		await fireEvent.press(screen.getByText("app:auth.createAccount"));
		await waitFor(() => expect(KeycloakAuth.register).toHaveBeenCalled());
		expect(KeycloakAuth.login).not.toHaveBeenCalled();
	});

	it("says nothing when the player backs out of the browser", async () => {
		await renderLogin();

		await fireEvent.press(screen.getByText("app:auth.withDiscord"));
		await waitFor(() => expect(KeycloakAuth.login).toHaveBeenCalled());
		expect(screen.queryByText(/app:auth\.loginFailed/)).toBeNull();
	});

	it("explains a refusal in the player's words, never the protocol's", async () => {
		jest.mocked(KeycloakAuth.login).mockRejectedValue(new AuthFailure(AUTH_FAILURES.DENIED, "The user denied the request"));
		await renderLogin();

		await fireEvent.press(screen.getByText("app:auth.withDiscord"));
		await waitFor(() => expect(screen.getByText("app:auth.failures.denied")).toBeTruthy());
		expect(screen.getByText("app:auth.loginFailed")).toBeTruthy();
	});
});
