import {
	fireEvent, render, screen, waitFor
} from "@testing-library/react-native";
import {Alert} from "react-native";
import React from "react";
import LoginScreen from "@/app/login";
import {AuthContext} from "@/src/authentication/AuthContext";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {KeycloakAuth} from "@/src/authentication/KeycloakAuth";
import {AssetsManager} from "@/src/assets/AssetsManager";
import {
	AUTH_FAILURES, AuthFailure
} from "@/src/authentication/AuthFailure";

jest.mock("expo-router", () => ({
	SplashScreen: {
		preventAutoHideAsync: jest.fn(),
		hideAsync: jest.fn()
	},
	useRouter: (): object => ({replace: jest.fn()})
}));
jest.mock("@/src/authentication/TokenStorage", () => ({
	readStoredToken: jest.fn().mockResolvedValue(null),
	writeStoredToken: jest.fn().mockResolvedValue(undefined),
	deleteStoredToken: jest.fn().mockResolvedValue(undefined)
}));
jest.mock("@/src/authentication/KeycloakAuth", () => ({
	IDENTITY_PROVIDERS: {DISCORD: "discord"},
	KeycloakAuth: {login: jest.fn()}
}));
jest.mock("@/src/assets/AssetsManager", () => ({AssetsManager: {
	areAssetsReady: jest.fn().mockReturnValue(false),
	updateAssets: jest.fn().mockResolvedValue(undefined)
}}));
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
		jest.mocked(AssetsManager.areAssetsReady).mockReturnValue(false);
		jest.mocked(AssetsManager.updateAssets).mockResolvedValue(undefined);
		jest.mocked(KeycloakAuth.login).mockRejectedValue(new AuthFailure(AUTH_FAILURES.CANCELLED, "dismiss"));
	});

	it("fetches its own translations, being rendered outside the protected group", async () => {
		await renderLogin();

		await waitFor(() => expect(AssetsManager.updateAssets).toHaveBeenCalled());
	});

	it("does not fetch again once the translations are there", async () => {
		jest.mocked(AssetsManager.areAssetsReady).mockReturnValue(true);

		await renderLogin();

		expect(AssetsManager.updateAssets).not.toHaveBeenCalled();
	});

	it("still lets the player in when the translations cannot be fetched", async () => {
		jest.mocked(AssetsManager.updateAssets).mockRejectedValue(new Error("offline"));
		jest.spyOn(console, "error").mockImplementation(() => undefined);
		await renderLogin();

		await fireEvent.press(screen.getByText("app:auth.withDiscord"));
		await waitFor(() => expect(KeycloakAuth.login).toHaveBeenCalledWith("discord"));
	});

	it("sends the Discord way straight to its provider, skipping the Keycloak picker", async () => {
		await renderLogin();

		await fireEvent.press(screen.getByText("app:auth.withDiscord"));
		await waitFor(() => expect(KeycloakAuth.login).toHaveBeenCalledWith("discord"));
	});

	it("leaves the choice to Keycloak for a Crownicles account", async () => {
		await renderLogin();

		await fireEvent.press(screen.getByText("app:auth.withAccount"));
		await waitFor(() => expect(KeycloakAuth.login).toHaveBeenCalledWith(undefined));
	});

	it("says nothing when the player backs out of the browser", async () => {
		const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
		await renderLogin();

		await fireEvent.press(screen.getByText("app:auth.withDiscord"));
		await waitFor(() => expect(KeycloakAuth.login).toHaveBeenCalled());
		expect(alert).not.toHaveBeenCalled();
	});

	it("explains a refusal in the player's words, never the protocol's", async () => {
		const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
		jest.mocked(KeycloakAuth.login).mockRejectedValue(new AuthFailure(AUTH_FAILURES.DENIED, "The user denied the request"));
		await renderLogin();

		await fireEvent.press(screen.getByText("app:auth.withDiscord"));
		await waitFor(() => expect(alert).toHaveBeenCalledWith("app:auth.loginFailed", "app:auth.failures.denied"));
	});
});
