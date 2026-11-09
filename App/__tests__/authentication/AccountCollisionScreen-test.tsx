import React from "react";
import { AppState } from "react-native";
import {
	act, fireEvent, render, screen, waitFor, within
} from "@testing-library/react-native";
import { AccountCollisionScreen } from "@/src/authentication/AccountCollisionScreen";
import { AuthContext } from "@/src/authentication/AuthContext";
import { AuthStateEnum } from "@/src/authentication/AuthStateEnum";
import { AuthToken } from "@/src/authentication/AuthToken";
import { KeycloakAuth } from "@/src/authentication/KeycloakAuth";
import { fakeAuthState } from "@/src/testing/fakeAuthState";
import {
	AUTH_FAILURES, AuthFailure
} from "@/src/authentication/AuthFailure";
import {
	AccountCollisionRequestFailure, RestApi
} from "@/src/networking/RestApi";
import {
	ACCOUNT_COLLISION_CHOICES, ACCOUNT_COLLISION_ERRORS, AccountCollisionCheck
} from "ws-packets/src/objects/AccountCollision";

jest.mock("expo-router", () => ({ useRouter: (): object => ({ replace: jest.fn() }) }));
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("@/src/networking/RestApi", () => ({
	...jest.requireActual<typeof import("@/src/networking/RestApi")>("@/src/networking/RestApi"),
	RestApi: {
		previewAccountCollision: jest.fn().mockResolvedValue({collision: null}),
		resolveAccountCollision: jest.fn(), checkAccountCollision: jest.fn()
	}
}));
jest.mock("@/src/authentication/KeycloakAuth", () => ({
	IDENTITY_PROVIDERS: { DISCORD: "discord" },
	ACCOUNT_ACTION_OUTCOMES: {
		PENDING: "pending", UPDATED: "updated", CANCELLED: "cancelled"
	},
	KeycloakAuth: {
		login: jest.fn(), loginAs: jest.fn(), refresh: jest.fn(), changeEmail: jest.fn()
	}
}));
jest.mock("@/src/translations/i18n", () => ({ i18n: { t: (key: string, options?: object): string => options ? `${key} ${JSON.stringify(options)}` : key } }));

const collision = {
	email: "same@example.test",
	discord: {
		name: "Historical hero",
		createdAt: Date.UTC(2021, 2, 12),
		adventure: {
			level: 42, score: 12_345, classId: 7
		}
	},
	emailAccount: {
		keycloakId: "email-account-id",
		progressionAvailable: true,
		name: "New hero", createdAt: Date.UTC(2026, 8, 30)
	}
};

/** What the plain check answers: the accounts, without asking the game where they stand. */
const collisionWithoutProgression = {
	email: collision.email,
	discord: {
		name: collision.discord.name, createdAt: collision.discord.createdAt
	},
	emailAccount: {
		keycloakId: collision.emailAccount.keycloakId, name: collision.emailAccount.name, createdAt: collision.emailAccount.createdAt
	}
};
const checkpoint = jest.fn().mockResolvedValue(undefined);
const authenticated = jest.fn().mockResolvedValue(undefined);

function token(accessToken: string): AuthToken {
	return new AuthToken({
		accessToken, refreshToken: "synthetic-refresh", accessTokenExpiresAt: new Date(Date.now() + 60_000), refreshTokenExpiresAt: "never"
	});
}

function keycloakLogin(accessToken: string): Awaited<ReturnType<typeof KeycloakAuth.login>> {
	return {
		access_token: accessToken, refresh_token: "synthetic-refresh", expires_in: 300, refresh_expires_in: 0, token_type: "Bearer", session_state: "test-session", scope: "openid"
	};
}

/** Presses « keep this account » on the card of `kind` */
async function keep(kind: string): Promise<void> {
	await fireEvent.press(within(screen.getByTestId(`collision-account-${kind}`)).getByText("app:auth.collision.keep"));
}

async function renderCollision(check: AccountCollisionCheck = {
	collision, current: ACCOUNT_COLLISION_CHOICES.DISCORD
}, primary = "discord-access"): Promise<void> {
	const auth = fakeAuthState({
		state: AuthStateEnum.NO_TOKEN, enter: authenticated, checkpoint, accessToken: jest.fn().mockResolvedValue(primary)
	});
	await render(<AuthContext.Provider value={auth}><AccountCollisionScreen state={{
		token: token(primary), check
	}} onAuthenticated={authenticated} onCancel={jest.fn()} /></AuthContext.Provider>);
}

describe("account collision choice", () => {
	afterEach(() => {
		jest.restoreAllMocks();
		jest.useRealTimers();
	});

	beforeEach(() => {
		jest.clearAllMocks();
		jest.mocked(KeycloakAuth.login).mockResolvedValue(keycloakLogin("email-access"));
		jest.mocked(KeycloakAuth.loginAs).mockResolvedValue(keycloakLogin("email-access"));
		jest.mocked(RestApi.resolveAccountCollision).mockResolvedValue({ kept: ACCOUNT_COLLISION_CHOICES.DISCORD });
		jest.mocked(RestApi.checkAccountCollision).mockResolvedValue({
			collision, current: ACCOUNT_COLLISION_CHOICES.DISCORD
		});
	});

	it("shows both accounts with what tells them apart, without touching either", async () => {
		await renderCollision();
		const discord = within(screen.getByTestId("collision-account-discord"));
		const email = within(screen.getByTestId("collision-account-email"));
		expect(discord.getByText("Historical hero")).toBeTruthy();
		expect(discord.getByText("app:auth.collision.current")).toBeTruthy();
		expect(discord.getByText("42")).toBeTruthy();
		expect(email.getByText("New hero")).toBeTruthy();
		expect(email.queryByText("app:auth.collision.current")).toBeNull();
		expect(email.getByText("app:auth.collision.noAdventure")).toBeTruthy();
		expect(screen.getByText("app:auth.collision.keepBoth.explanation")).toBeTruthy();
		expect(RestApi.resolveAccountCollision).not.toHaveBeenCalled();
		expect(checkpoint).not.toHaveBeenCalled();
	});

	it("shows both accounts at once, then the progression the game reads for each", async () => {
		let answer!: (check: AccountCollisionCheck) => void;
		jest.mocked(RestApi.previewAccountCollision).mockReturnValueOnce(new Promise(resolve => {
			answer = resolve;
		}));
		await renderCollision({
			collision: collisionWithoutProgression, current: ACCOUNT_COLLISION_CHOICES.DISCORD
		});
		const email = within(screen.getByTestId("collision-account-email"));
		expect(email.getByText("New hero")).toBeTruthy();
		expect(email.getByText("app:common.loading")).toBeTruthy();
		await act(async () => answer({
			collision: {
				...collisionWithoutProgression,
				emailAccount: {
					...collisionWithoutProgression.emailAccount, progressionAvailable: true, adventure: {
						level: 3, score: 120, classId: 1
					}
				}
			},
			current: ACCOUNT_COLLISION_CHOICES.DISCORD
		}));
		expect(email.getByText("3")).toBeTruthy();
		expect(email.queryByText("app:common.loading")).toBeNull();
	});

	it("says a progression is unavailable, never absent, when the game cannot tell it", async () => {
		jest.mocked(RestApi.previewAccountCollision).mockRejectedValueOnce(new AccountCollisionRequestFailure(ACCOUNT_COLLISION_ERRORS.UNAVAILABLE));
		await renderCollision({
			collision: collisionWithoutProgression, current: ACCOUNT_COLLISION_CHOICES.DISCORD
		});
		await waitFor(() => expect(within(screen.getByTestId("collision-account-email")).getByText("app:auth.collision.progressionUnavailable")).toBeTruthy());
		expect(screen.queryByText("app:auth.collision.noAdventure")).toBeNull();
		expect(screen.queryByText("app:common.loading")).toBeNull();
	});

	it("deletes nothing when the player backs out of the second sign-in", async () => {
		jest.mocked(KeycloakAuth.loginAs).mockRejectedValueOnce(new AuthFailure(AUTH_FAILURES.CANCELLED, "closed"));
		await renderCollision();
		await keep("email");
		await waitFor(() => expect(KeycloakAuth.loginAs).toHaveBeenCalledTimes(1));
		expect(RestApi.resolveAccountCollision).not.toHaveBeenCalled();
		expect(checkpoint).not.toHaveBeenCalled();
		expect(screen.getByTestId("collision-account-discord")).toBeTruthy();
	});

	it.each([
		{
			choice: ACCOUNT_COLLISION_CHOICES.DISCORD, access: "discord-access"
		},
		{
			choice: ACCOUNT_COLLISION_CHOICES.EMAIL, access: "email-access"
		}
	])("keeps exactly the account whose button was pressed ($choice)", async ({
		choice, access
	}) => {
		await renderCollision();
		await keep(choice);
		await waitFor(() => expect(authenticated).toHaveBeenCalledTimes(1));
		expect(KeycloakAuth.loginAs).toHaveBeenCalledWith(collision.email);
		expect(RestApi.resolveAccountCollision).toHaveBeenCalledWith(access, choice === ACCOUNT_COLLISION_CHOICES.DISCORD ? "email-access" : "discord-access", choice);
		expect(checkpoint).toHaveBeenCalledTimes(1);
		expect((checkpoint.mock.calls[0][0] as AuthToken).getAccessToken()).toBe(access);
	});

	it("keeps the account of the shared address without a Discord sign-in when starting from it", async () => {
		await renderCollision({
			collision, current: ACCOUNT_COLLISION_CHOICES.EMAIL
		}, "email-access");
		expect(within(screen.getByTestId("collision-account-email")).getByText("app:auth.collision.current")).toBeTruthy();
		expect(within(screen.getByTestId("collision-account-email")).queryByText("app:auth.collision.proveDiscord")).toBeNull();
		await keep(ACCOUNT_COLLISION_CHOICES.EMAIL);
		await waitFor(() => expect(authenticated).toHaveBeenCalledTimes(1));
		expect(KeycloakAuth.login).not.toHaveBeenCalled();
		expect(KeycloakAuth.loginAs).not.toHaveBeenCalled();
		expect(RestApi.resolveAccountCollision).toHaveBeenCalledWith("email-access", "", ACCOUNT_COLLISION_CHOICES.EMAIL);
		expect((checkpoint.mock.calls[0][0] as AuthToken).getAccessToken()).toBe("email-access");
	});

	it("signs in to Discord to keep it when starting from the shared address", async () => {
		jest.mocked(KeycloakAuth.login).mockResolvedValueOnce(keycloakLogin("discord-access"));
		await renderCollision({
			collision, current: ACCOUNT_COLLISION_CHOICES.EMAIL
		}, "email-access");
		expect(within(screen.getByTestId("collision-account-discord")).getByText("app:auth.collision.proveDiscord")).toBeTruthy();
		await keep(ACCOUNT_COLLISION_CHOICES.DISCORD);
		await waitFor(() => expect(authenticated).toHaveBeenCalledTimes(1));
		expect(KeycloakAuth.login).toHaveBeenCalledWith("discord");
		expect(RestApi.resolveAccountCollision).toHaveBeenCalledWith("discord-access", "email-access", ACCOUNT_COLLISION_CHOICES.DISCORD);
		expect((authenticated.mock.calls[0][0] as AuthToken).getAccessToken()).toBe("discord-access");
	});

	it("resumes the already-confirmed choice after interruption instead of offering another account", async () => {
		await renderCollision({
			collision: null, pending: ACCOUNT_COLLISION_CHOICES.EMAIL
		}, "email-access");
		expect(screen.queryByText("app:auth.collision.keep")).toBeNull();
		await fireEvent.press(screen.getByText("app:auth.collision.resume"));
		await waitFor(() => expect(authenticated).toHaveBeenCalledTimes(1));
		expect(KeycloakAuth.login).not.toHaveBeenCalled();
		expect(RestApi.resolveAccountCollision).toHaveBeenCalledWith("email-access", "", ACCOUNT_COLLISION_CHOICES.EMAIL);
	});

	it("opens the restored account when another device already settled the collision", async () => {
		await renderCollision({ collision: null });
		await waitFor(() => expect(authenticated).toHaveBeenCalledTimes(1));
		expect((authenticated.mock.calls[0][0] as AuthToken).getAccessToken()).toBe("discord-access");
		expect(RestApi.resolveAccountCollision).not.toHaveBeenCalled();
		expect(KeycloakAuth.login).not.toHaveBeenCalled();
		expect(KeycloakAuth.loginAs).not.toHaveBeenCalled();
		expect(screen.queryByText("app:auth.collision.resumeNote")).toBeNull();
	});

	it("can retry opening an already-settled account without repeating a destructive choice", async () => {
		authenticated.mockRejectedValueOnce(new Error("Connection unavailable"));
		await renderCollision({ collision: null });
		await waitFor(() => expect(screen.getByText("app:auth.collision.errors.unavailable")).toBeTruthy());
		expect(authenticated).toHaveBeenCalledTimes(1);
		await fireEvent.press(screen.getByText("app:common.continue"));
		await waitFor(() => expect(authenticated).toHaveBeenCalledTimes(2));
		expect(RestApi.resolveAccountCollision).not.toHaveBeenCalled();
	});

	it("does not offer a different choice after a confirmed resolution fails", async () => {
		jest.mocked(RestApi.resolveAccountCollision).mockRejectedValueOnce(new AccountCollisionRequestFailure(ACCOUNT_COLLISION_ERRORS.UNAVAILABLE));
		await renderCollision();
		await keep(ACCOUNT_COLLISION_CHOICES.DISCORD);
		await waitFor(() => expect(screen.getByText("app:auth.collision.errors.unavailable")).toBeTruthy());
		expect(screen.queryByText("app:auth.collision.keep")).toBeNull();
		expect(authenticated).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByText("app:auth.collision.resume"));
		await waitFor(() => expect(authenticated).toHaveBeenCalledTimes(1));
		expect(RestApi.resolveAccountCollision).toHaveBeenLastCalledWith("discord-access", "email-access", ACCOUNT_COLLISION_CHOICES.DISCORD);
	});

	it("offers both accounts again if the second session changed before a choice was recorded", async () => {
		jest.mocked(RestApi.resolveAccountCollision).mockRejectedValueOnce(new AccountCollisionRequestFailure(ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED));
		await renderCollision();
		await keep(ACCOUNT_COLLISION_CHOICES.DISCORD);
		await waitFor(() => expect(screen.getByText("app:auth.collision.errors.accountChanged")).toBeTruthy());
		expect(screen.getAllByText("app:auth.collision.keep")).toHaveLength(2);
		expect(screen.getByText("app:common.back")).toBeTruthy();
		expect(screen.queryByText("app:auth.collision.resume")).toBeNull();
		expect(authenticated).not.toHaveBeenCalled();
	});

	it("lets the player in with both accounts once the email account has another address", async () => {
		jest.mocked(KeycloakAuth.changeEmail).mockResolvedValueOnce("pending");
		jest.mocked(RestApi.checkAccountCollision).mockResolvedValueOnce({ collision: null });
		await renderCollision();
		await fireEvent.press(screen.getByText("app:auth.collision.keepBoth.action"));
		await waitFor(() => expect(authenticated).toHaveBeenCalledTimes(1));
		expect(KeycloakAuth.changeEmail).toHaveBeenCalledWith({keycloakId: "email-account-id", loginHint: collision.email});
		expect((authenticated.mock.calls[0][0] as AuthToken).getAccessToken()).toBe("discord-access");
		expect(RestApi.resolveAccountCollision).not.toHaveBeenCalled();
	});

	it("waits for the confirmation link while the new address is not confirmed yet", async () => {
		jest.mocked(KeycloakAuth.changeEmail).mockResolvedValueOnce("pending");
		await renderCollision();
		await fireEvent.press(screen.getByText("app:auth.collision.keepBoth.action"));
		await waitFor(() => expect(screen.getByText("app:auth.collision.keepBoth.awaitingLink")).toBeTruthy());
		await waitFor(() => expect(RestApi.checkAccountCollision).toHaveBeenCalledWith("discord-access"));
		expect(authenticated).not.toHaveBeenCalled();
	});

	it("does not start watching or notify a failure when the email change is cancelled", async () => {
		jest.useFakeTimers();
		jest.mocked(KeycloakAuth.changeEmail).mockResolvedValueOnce("cancelled");
		await renderCollision();
		await fireEvent.press(screen.getByText("app:auth.collision.keepBoth.action"));
		await act(async (): Promise<void> => {
			await jest.advanceTimersByTimeAsync(12_000);
		});
		expect(RestApi.checkAccountCollision).not.toHaveBeenCalled();
		expect(screen.queryByText("app:auth.collision.keepBoth.awaitingLink")).toBeNull();
		expect(screen.queryByText("app:auth.collision.keepBoth.failed")).toBeNull();
	});

	it("recovers from a temporary collision recheck failure", async () => {
		jest.useFakeTimers();
		jest.mocked(KeycloakAuth.changeEmail).mockResolvedValueOnce("pending");
		jest.mocked(RestApi.checkAccountCollision).mockRejectedValueOnce(new AccountCollisionRequestFailure(ACCOUNT_COLLISION_ERRORS.UNAVAILABLE));
		await renderCollision();
		await fireEvent.press(screen.getByText("app:auth.collision.keepBoth.action"));
		await act(async (): Promise<void> => {
			await Promise.resolve();
		});
		expect(screen.getByText("app:auth.collision.errors.unavailable")).toBeTruthy();
		jest.mocked(RestApi.checkAccountCollision).mockResolvedValue({ collision: null });
		await act(async (): Promise<void> => {
			await jest.advanceTimersByTimeAsync(4_000);
		});
		expect(authenticated).toHaveBeenCalledTimes(1);
		expect(screen.queryByText("app:auth.collision.errors.unavailable")).toBeNull();
	});

	it("notices a link confirmed on another device while the app stays open", async () => {
		jest.useFakeTimers();
		jest.mocked(KeycloakAuth.changeEmail).mockResolvedValueOnce("pending");
		await renderCollision();
		await fireEvent.press(screen.getByText("app:auth.collision.keepBoth.action"));
		await act(async (): Promise<void> => {
			await Promise.resolve();
		});
		expect(RestApi.checkAccountCollision).toHaveBeenCalledTimes(1);
		jest.mocked(RestApi.checkAccountCollision).mockResolvedValue({ collision: null });
		await act(async (): Promise<void> => {
			await jest.advanceTimersByTimeAsync(4_000);
		});
		expect(authenticated).toHaveBeenCalledTimes(1);
		expect(RestApi.resolveAccountCollision).not.toHaveBeenCalled();
	});

	it("pauses rechecks in the background and checks immediately on returning", async () => {
		jest.useFakeTimers();
		const originalState = AppState.currentState;
		const subscriptions = jest.spyOn(AppState, "addEventListener");
		Reflect.set(AppState, "currentState", "background");
		try {
			jest.mocked(KeycloakAuth.changeEmail).mockResolvedValueOnce("pending");
			await renderCollision();
			await fireEvent.press(screen.getByText("app:auth.collision.keepBoth.action"));
			await act(async (): Promise<void> => {
				await jest.advanceTimersByTimeAsync(4_000);
			});
			expect(RestApi.checkAccountCollision).not.toHaveBeenCalled();
			Reflect.set(AppState, "currentState", "active");
			await act(async (): Promise<void> => {
				subscriptions.mock.calls.at(-1)?.[1]("active");
			});
			expect(RestApi.checkAccountCollision).toHaveBeenCalledTimes(1);
		}
		finally {
			Reflect.set(AppState, "currentState", originalState);
		}
	});

	it("keeps a failed session opening retryable when the parent callback changes", async () => {
		let rejectOpening!: (error: Error) => void;
		authenticated.mockReturnValueOnce(new Promise<void>((_resolve, reject) => {
			rejectOpening = reject;
		}));
		const state = {
			token: token("discord-access"),
			check: {
				collision, current: ACCOUNT_COLLISION_CHOICES.DISCORD
			}
		};
		jest.mocked(KeycloakAuth.changeEmail).mockResolvedValueOnce("pending");
		jest.mocked(RestApi.checkAccountCollision).mockResolvedValueOnce({ collision: null });
		await render(<AccountCollisionScreen state={state} onAuthenticated={authenticated} onCancel={jest.fn()} />);
		await fireEvent.press(screen.getByText("app:auth.collision.keepBoth.action"));
		await waitFor(() => expect(authenticated).toHaveBeenCalledTimes(1));
		await screen.rerender(<AccountCollisionScreen state={state} onAuthenticated={jest.fn()} onCancel={jest.fn()} />);
		await act(async (): Promise<void> => {
			rejectOpening(new Error("Connection unavailable"));
		});
		expect(screen.getByText("app:auth.collision.errors.unavailable")).toBeTruthy();
		expect(screen.getByRole("button", {
			name: "app:common.back", disabled: false
		})).toBeTruthy();
	});

	it("does not overlap collision rechecks while a previous response is pending", async () => {
		jest.useFakeTimers();
		jest.mocked(KeycloakAuth.changeEmail).mockResolvedValueOnce("pending");
		jest.mocked(RestApi.checkAccountCollision).mockReturnValueOnce(new Promise(() => undefined));
		await renderCollision();
		await fireEvent.press(screen.getByText("app:auth.collision.keepBoth.action"));
		await act(async (): Promise<void> => {
			await jest.advanceTimersByTimeAsync(12_000);
		});
		expect(RestApi.checkAccountCollision).toHaveBeenCalledTimes(1);
		expect(authenticated).not.toHaveBeenCalled();
	});

	it("ignores a pending collision response after leaving the screen", async () => {
		let finish!: (check: AccountCollisionCheck) => void;
		jest.mocked(KeycloakAuth.changeEmail).mockResolvedValueOnce("pending");
		jest.mocked(RestApi.checkAccountCollision).mockReturnValueOnce(new Promise(resolve => {
			finish = resolve;
		}));
		await renderCollision();
		await fireEvent.press(screen.getByText("app:auth.collision.keepBoth.action"));
		await waitFor(() => expect(RestApi.checkAccountCollision).toHaveBeenCalledTimes(1));
		await screen.unmount();
		await act(async (): Promise<void> => {
			finish({ collision: null });
		});
		expect(authenticated).not.toHaveBeenCalled();
	});

	it("does not let a stale email-watching response replace the chosen account", async () => {
		let finishCheck!: (check: AccountCollisionCheck) => void;
		let finishLogin!: () => void;
		jest.mocked(KeycloakAuth.changeEmail).mockResolvedValueOnce("pending");
		jest.mocked(RestApi.checkAccountCollision).mockReturnValueOnce(new Promise(resolve => {
			finishCheck = resolve;
		}));
		jest.mocked(KeycloakAuth.loginAs).mockReturnValueOnce(new Promise(resolve => {
			finishLogin = (): void => resolve(keycloakLogin("email-access"));
		}));
		await renderCollision();
		await fireEvent.press(screen.getByText("app:auth.collision.keepBoth.action"));
		await waitFor(() => expect(RestApi.checkAccountCollision).toHaveBeenCalledTimes(1));
		await keep(ACCOUNT_COLLISION_CHOICES.EMAIL);
		await act(async (): Promise<void> => {
			finishCheck({ collision: null });
		});
		expect(authenticated).not.toHaveBeenCalled();
		await act(async (): Promise<void> => {
			finishLogin();
		});
		await waitFor(() => expect(authenticated).toHaveBeenCalledTimes(1));
		expect((authenticated.mock.calls[0][0] as AuthToken).getAccessToken()).toBe("email-access");
		expect(RestApi.resolveAccountCollision).toHaveBeenCalledWith("email-access", "discord-access", ACCOUNT_COLLISION_CHOICES.EMAIL);
	});

	it("opens the kept account when the server finished but its first response was lost", async () => {
		jest.mocked(RestApi.resolveAccountCollision).mockRejectedValueOnce(new AccountCollisionRequestFailure(ACCOUNT_COLLISION_ERRORS.ACCOUNT_CHANGED));
		jest.mocked(RestApi.checkAccountCollision).mockResolvedValueOnce({ collision: null });
		await renderCollision({
			collision: null, pending: ACCOUNT_COLLISION_CHOICES.EMAIL
		}, "email-access");
		await fireEvent.press(screen.getByText("app:auth.collision.resume"));
		await waitFor(() => expect(authenticated).toHaveBeenCalledTimes(1));
		expect(RestApi.checkAccountCollision).toHaveBeenCalledWith("email-access");
		expect(RestApi.resolveAccountCollision).toHaveBeenCalledTimes(1);
	});

	it("does not send a second confirmation while resolution is pending", async () => {
		let finish!: () => void;
		jest.mocked(RestApi.resolveAccountCollision).mockReturnValueOnce(new Promise(resolve => {
			finish = (): void => resolve({ kept: ACCOUNT_COLLISION_CHOICES.DISCORD });
		}));
		await renderCollision({
			collision: null, pending: ACCOUNT_COLLISION_CHOICES.DISCORD
		});
		await fireEvent.press(screen.getByText("app:auth.collision.resume"));
		await waitFor(() => expect(RestApi.resolveAccountCollision).toHaveBeenCalledTimes(1));
		await fireEvent.press(screen.getByText("app:auth.collision.resume"));
		expect(RestApi.resolveAccountCollision).toHaveBeenCalledTimes(1);
		await act(async (): Promise<void> => {
			finish();
		});
	});
});
