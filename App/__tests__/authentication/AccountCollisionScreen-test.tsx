import React from "react";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {AccountCollisionScreen} from "@/src/authentication/AccountCollisionScreen";
import {AuthContext} from "@/src/authentication/AuthContext";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {AuthToken} from "@/src/authentication/AuthToken";
import {KeycloakAuth} from "@/src/authentication/KeycloakAuth";
import {AccountCollisionRequestFailure, RestApi} from "@/src/networking/RestApi";
import {ACCOUNT_COLLISION_CHOICES, ACCOUNT_COLLISION_ERRORS, AccountCollisionCheck} from "ws-packets/src/objects/AccountCollision";

jest.mock("expo-router", () => ({useRouter: (): object => ({replace: jest.fn()})}));
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("@/src/networking/RestApi", () => ({
	...jest.requireActual<typeof import("@/src/networking/RestApi")>("@/src/networking/RestApi"),
	RestApi: {verifyAccountCollision: jest.fn(), resolveAccountCollision: jest.fn(), checkAccountCollision: jest.fn()}
}));
jest.mock("@/src/authentication/KeycloakAuth", () => ({IDENTITY_PROVIDERS: {DISCORD: "discord"}, KeycloakAuth: {login: jest.fn(), refresh: jest.fn()}}));
jest.mock("@/src/translations/i18n", () => ({i18n: {t: (key: string, options?: object): string => options ? `${key} ${JSON.stringify(options)}` : key}}));

const collision = {email: "same@example.test", discord: {name: "Historical hero"}, emailAccount: {name: "New hero"}};
const saveToken = jest.fn().mockResolvedValue(undefined);
const authenticated = jest.fn().mockResolvedValue(undefined);

function token(accessToken: string): AuthToken {
	return new AuthToken({accessToken, refreshToken: "synthetic-refresh", accessTokenExpiresAt: new Date(Date.now() + 60_000), refreshTokenExpiresAt: "never"});
}

async function renderCollision(check: AccountCollisionCheck = {collision, current: ACCOUNT_COLLISION_CHOICES.DISCORD}, primary = "discord-access"): Promise<void> {
	const auth: React.ContextType<typeof AuthContext> = {state: AuthStateEnum.NO_TOKEN, setState: jest.fn(), saveToken, clearToken: jest.fn().mockResolvedValue(undefined)};
	await render(<AuthContext.Provider value={auth}><AccountCollisionScreen state={{token: token(primary), check}} onAuthenticated={authenticated} onCancel={jest.fn()} /></AuthContext.Provider>);
}

describe("account collision choice", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.mocked(KeycloakAuth.login).mockResolvedValue({access_token: "email-access", refresh_token: "synthetic-refresh", expires_in: 300, refresh_expires_in: 0, token_type: "Bearer", session_state: "test-session", scope: "openid"});
		jest.mocked(RestApi.verifyAccountCollision).mockResolvedValue({proof: "verified-proof", collision});
		jest.mocked(RestApi.resolveAccountCollision).mockResolvedValue({kept: ACCOUNT_COLLISION_CHOICES.DISCORD});
		jest.mocked(RestApi.checkAccountCollision).mockResolvedValue({collision, current: ACCOUNT_COLLISION_CHOICES.DISCORD});
	});

	it("requires the second account and an explicit choice before any destructive request", async () => {
		await renderCollision();
		expect(RestApi.resolveAccountCollision).not.toHaveBeenCalled();
		expect(saveToken).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:auth.collision.verifyEmail"));
		await waitFor(() => expect(screen.getByText("app:auth.collision.chooseFirst")).toBeTruthy());
		await fireEvent.press(screen.getByText("app:auth.collision.confirm"));
		expect(RestApi.resolveAccountCollision).not.toHaveBeenCalled();
		expect(saveToken).not.toHaveBeenCalled();
	});

	it.each([
		{choice: ACCOUNT_COLLISION_CHOICES.DISCORD, label: "discord", access: "discord-access"},
		{choice: ACCOUNT_COLLISION_CHOICES.EMAIL, label: "email", access: "email-access"}
	])("saves only the chosen account and confirms exactly that choice ($choice)", async ({choice, label, access}) => {
		await renderCollision();
		await fireEvent.press(screen.getByText("app:auth.collision.verifyEmail"));
		await waitFor(() => expect(screen.getByText("app:auth.collision.choose")).toBeTruthy());
		await fireEvent.press(screen.getByText(new RegExp(`^app:auth.collision.${label} `)));
		await fireEvent.press(screen.getByText("app:auth.collision.confirm"));
		await waitFor(() => expect(authenticated).toHaveBeenCalledTimes(1));
		expect(RestApi.verifyAccountCollision).toHaveBeenCalledWith("discord-access", "email-access");
		expect(RestApi.resolveAccountCollision).toHaveBeenCalledWith(access, "verified-proof", choice);
		expect(saveToken).toHaveBeenCalledTimes(1);
		expect((saveToken.mock.calls[0][0] as AuthToken).getAccessToken()).toBe(access);
	});

	it("authenticates Discord as the second account when starting from email", async () => {
		jest.mocked(KeycloakAuth.login).mockResolvedValueOnce({access_token: "discord-access", refresh_token: "synthetic-refresh", expires_in: 300, refresh_expires_in: 0, token_type: "Bearer", session_state: "test-session", scope: "openid"});
		await renderCollision({collision, current: ACCOUNT_COLLISION_CHOICES.EMAIL}, "email-access");
		await fireEvent.press(screen.getByText("app:auth.collision.verifyDiscord"));
		await waitFor(() => expect(RestApi.verifyAccountCollision).toHaveBeenCalled());
		expect(KeycloakAuth.login).toHaveBeenCalledWith("discord");
		expect(RestApi.verifyAccountCollision).toHaveBeenCalledWith("discord-access", "email-access");
	});

	it("resumes the already-confirmed choice after interruption instead of offering another account", async () => {
		await renderCollision({collision: null, pending: ACCOUNT_COLLISION_CHOICES.EMAIL}, "email-access");
		expect(screen.queryByText("app:auth.collision.choose")).toBeNull();
		await fireEvent.press(screen.getByText("app:auth.collision.resume"));
		await waitFor(() => expect(authenticated).toHaveBeenCalledTimes(1));
		expect(KeycloakAuth.login).not.toHaveBeenCalled();
		expect(RestApi.resolveAccountCollision).toHaveBeenCalledWith("email-access", "", ACCOUNT_COLLISION_CHOICES.EMAIL);
	});

	it("does not offer a different choice after a confirmed resolution fails", async () => {
		jest.mocked(RestApi.resolveAccountCollision).mockRejectedValueOnce(new AccountCollisionRequestFailure(ACCOUNT_COLLISION_ERRORS.UNAVAILABLE));
		await renderCollision();
		await fireEvent.press(screen.getByText("app:auth.collision.verifyEmail"));
		await waitFor(() => expect(screen.getByText("app:auth.collision.choose")).toBeTruthy());
		await fireEvent.press(screen.getByText(/^app:auth.collision.discord /));
		await fireEvent.press(screen.getByText("app:auth.collision.confirm"));
		await waitFor(() => expect(screen.getByText("app:auth.collision.errors.unavailable")).toBeTruthy());
		expect(screen.queryByText("app:auth.collision.choose")).toBeNull();
		expect(authenticated).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:auth.collision.resume"));
		await waitFor(() => expect(authenticated).toHaveBeenCalledTimes(1));
	});

	it("returns to verification if the proof expires before any choice was started on the server", async () => {
		jest.mocked(RestApi.resolveAccountCollision).mockRejectedValueOnce(new AccountCollisionRequestFailure(ACCOUNT_COLLISION_ERRORS.PROOF_EXPIRED));
		await renderCollision();
		await fireEvent.press(screen.getByText("app:auth.collision.verifyEmail"));
		await waitFor(() => expect(screen.getByText("app:auth.collision.choose")).toBeTruthy());
		await fireEvent.press(screen.getByText(/^app:auth.collision.discord /));
		await fireEvent.press(screen.getByText("app:auth.collision.confirm"));
		await waitFor(() => expect(screen.getByText("app:auth.collision.errors.proofExpired")).toBeTruthy());
		expect(screen.getByText("app:auth.collision.verifyEmail")).toBeTruthy();
		expect(screen.getByText("app:common.back")).toBeTruthy();
		expect(screen.queryByText("app:auth.collision.resume")).toBeNull();
		expect(authenticated).not.toHaveBeenCalled();
	});

	it("opens the kept account when the server finished but its first response was lost", async () => {
		jest.mocked(RestApi.resolveAccountCollision).mockRejectedValueOnce(new AccountCollisionRequestFailure(ACCOUNT_COLLISION_ERRORS.PROOF_EXPIRED));
		jest.mocked(RestApi.checkAccountCollision).mockResolvedValueOnce({collision: null});
		await renderCollision({collision: null, pending: ACCOUNT_COLLISION_CHOICES.EMAIL}, "email-access");
		await fireEvent.press(screen.getByText("app:auth.collision.resume"));
		await waitFor(() => expect(authenticated).toHaveBeenCalledTimes(1));
		expect(RestApi.checkAccountCollision).toHaveBeenCalledWith("email-access");
		expect(RestApi.resolveAccountCollision).toHaveBeenCalledTimes(1);
	});

	it("does not send a second confirmation while resolution is pending", async () => {
		let finish!: () => void;
		jest.mocked(RestApi.resolveAccountCollision).mockReturnValueOnce(new Promise(resolve => { finish = (): void => resolve({kept: ACCOUNT_COLLISION_CHOICES.DISCORD}); }));
		await renderCollision({collision: null, pending: ACCOUNT_COLLISION_CHOICES.DISCORD});
		await fireEvent.press(screen.getByText("app:auth.collision.resume"));
		await waitFor(() => expect(RestApi.resolveAccountCollision).toHaveBeenCalledTimes(1));
		await fireEvent.press(screen.getByText("app:auth.collision.resume"));
		expect(RestApi.resolveAccountCollision).toHaveBeenCalledTimes(1);
		await act(async (): Promise<void> => { finish(); });
	});
});