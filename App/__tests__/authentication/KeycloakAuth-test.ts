import {
	ACCOUNT_ACTION_OUTCOMES, IDENTITY_PROVIDERS, KeycloakAuth
} from "@/src/authentication/KeycloakAuth";
import { KeycloakOAuth2Token } from "@/src/authentication/KeycloakOAuth2Token";
import { AUTH_FAILURES } from "@/src/authentication/AuthFailure";

const mockPromptAsync = jest.fn();
const mockOpenAuthSession = jest.fn();
const mockAuthRequestConfigs: Record<string, unknown>[] = [];

jest.mock("expo-auth-session", () => ({
	AuthRequest: class {
		public codeVerifier = "code-verifier";

		public state = "s";

		public promptAsync = mockPromptAsync;

		public constructor(config: Record<string, unknown>) {
			mockAuthRequestConfigs.push(config);
		}

		public makeAuthUrlAsync(): Promise<string> {
			return Promise.resolve("https://keycloak.example.com/auth?state=s");
		}
	},
	makeRedirectUri: (): string => "crownicles://auth",
	ResponseType: { Code: "code" }
}));

jest.mock("expo-web-browser", () => ({
	openAuthSessionAsync: (...args: unknown[]): unknown => mockOpenAuthSession(...args)
}));

jest.mock("@/src/translations/i18nLoader", () => ({
	currentLanguage: (): string => "fr"
}));

function offlineToken(): KeycloakOAuth2Token {
	return {
		access_token: "access-token",
		expires_in: 300,
		refresh_expires_in: 0,
		refresh_token: "refresh-token",
		token_type: "Bearer",
		session_state: "session",
		scope: "openid offline_access"
	};
}

/** Keycloak's token endpoint, and a userinfo naming `subject` as the account signed in. */
function keycloakAnswers(subject = "current-account"): jest.SpyInstance {
	return jest.spyOn(globalThis, "fetch").mockImplementation(input => Promise.resolve(new Response(JSON.stringify(String(input).endsWith("/userinfo") ? { sub: subject } : offlineToken()), { status: 200 })));
}

describe("KeycloakAuth", () => {
	beforeEach((): void => {
		process.env.EXPO_PUBLIC_KEYCLOAK_URL = "https://keycloak.example.com";
		process.env.EXPO_PUBLIC_KEYCLOAK_REALM = "crownicles";
		process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID = "crownicles-app";
		mockAuthRequestConfigs.length = 0;
		mockPromptAsync.mockReset();
		mockOpenAuthSession.mockReset();
		keycloakAnswers();
	});

	afterEach((): void => {
		jest.restoreAllMocks();
	});

	it("accepts Keycloak offline token responses without a refresh expiry", async () => {
		const token = offlineToken();
		const response = new Response(JSON.stringify(token), { status: 200 });
		const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(response);

		await expect(KeycloakAuth.refresh("refresh-token")).resolves.toEqual(token);
		expect(fetch).toHaveBeenCalledWith(
			"https://keycloak.example.com/realms/crownicles/protocol/openid-connect/token",
			expect.objectContaining({ method: "POST" })
		);
	});

	it("names the provider so Keycloak skips its picker", async () => {
		mockPromptAsync.mockResolvedValue({
			type: "success",
			params: { code: "authorization-code" }
		});
		jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(offlineToken()), { status: 200 }));

		await KeycloakAuth.login(IDENTITY_PROVIDERS.DISCORD);

		expect(mockAuthRequestConfigs.at(-1)).toMatchObject({ extraParams: {
			kc_idp_hint: "discord", prompt: "login"
		} });
		expect(mockPromptAsync).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ preferEphemeralSession: true }));
	});

	it("leaves the choice to Keycloak when no provider is named", async () => {
		mockPromptAsync.mockResolvedValue({
			type: "success",
			params: { code: "authorization-code" }
		});
		jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(offlineToken()), { status: 200 }));

		await KeycloakAuth.login();

		expect(mockAuthRequestConfigs.at(-1)?.extraParams).not.toHaveProperty("kc_idp_hint");
		expect(mockAuthRequestConfigs.at(-1)).toMatchObject({ extraParams: { prompt: "login" } });
	});

	it("types in the account to sign in to, in a throwaway browser session", async () => {
		mockPromptAsync.mockResolvedValue({
			type: "success",
			params: { code: "authorization-code" }
		});
		jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(offlineToken()), { status: 200 }));

		await KeycloakAuth.loginAs("player@example.test");

		expect(mockAuthRequestConfigs.at(-1)).toHaveProperty("extraParams.login_hint", "player@example.test");
		expect(mockAuthRequestConfigs.at(-1)).toHaveProperty("extraParams.prompt", "login");
		expect(mockAuthRequestConfigs.at(-1)?.extraParams).not.toHaveProperty("kc_idp_hint");
		expect(mockPromptAsync).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ preferEphemeralSession: true }));
	});

	it("opens the sign-up page and returns the token of the account just created", async () => {
		mockPromptAsync.mockResolvedValue({
			type: "success",
			params: { code: "authorization-code" }
		});
		jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(offlineToken()), { status: 200 }));

		await expect(KeycloakAuth.register()).resolves.toEqual(offlineToken());
		expect(mockAuthRequestConfigs.at(-1)).toMatchObject({
			extraParams: {
				prompt: "create", ui_locales: "fr"
			},
			usePKCE: true
		});
		expect(mockPromptAsync.mock.calls.at(-1)?.[1]).not.toHaveProperty("preferEphemeralSession");
	});

	it("asks Keycloak for the pages in the language of the app", async () => {
		mockPromptAsync.mockResolvedValue({
			type: "success",
			params: { code: "authorization-code" }
		});
		jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(offlineToken()), { status: 200 }));

		await KeycloakAuth.login();

		expect(mockAuthRequestConfigs.at(-1)).toMatchObject({ extraParams: { ui_locales: "fr" } });
	});

	it("reports a cancellation as such rather than as a failure", async () => {
		mockPromptAsync.mockResolvedValue({ type: "dismiss" });

		await expect(KeycloakAuth.login()).rejects.toMatchObject({ reason: AUTH_FAILURES.CANCELLED });
	});

	it("reports an unusable token without leaking the protocol wording", async () => {
		mockPromptAsync.mockResolvedValue({
			type: "success",
			params: { code: "authorization-code" }
		});
		jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ access_token: "only-this" }), { status: 200 }));

		await expect(KeycloakAuth.login()).rejects.toMatchObject({ reason: AUTH_FAILURES.INVALID_TOKEN });
	});

	it("asks the password again before opening the email change, in a throwaway browser session", async () => {
		mockOpenAuthSession.mockResolvedValue({
			type: "success", url: "crownicles://"
		});
		const fetch = jest.spyOn(globalThis, "fetch");

		await expect(KeycloakAuth.changeEmail({keycloakId: "current-account"})).resolves.toBe(ACCOUNT_ACTION_OUTCOMES.PENDING);

		expect(mockAuthRequestConfigs.at(-1)).toMatchObject({ extraParams: {
			kc_action: "UPDATE_EMAIL", prompt: "login"
		} });
		expect(mockOpenAuthSession).toHaveBeenCalledWith(
			"https://keycloak.example.com/auth?state=s",
			"crownicles://auth",
			expect.objectContaining({ preferEphemeralSession: true })
		);
		expect(fetch).not.toHaveBeenCalled();
	});

	it.each([
		{
			result: {
				type: "success", url: "crownicles://auth?code=c&state=s&kc_action=UPDATE_EMAIL&kc_action_status=cancelled"
			},
			outcome: ACCOUNT_ACTION_OUTCOMES.CANCELLED
		},
		{
			result: {
				type: "success", url: "crownicles://auth?code=c&state=s&kc_action=UPDATE_EMAIL&kc_action_status=success"
			},
			outcome: ACCOUNT_ACTION_OUTCOMES.UPDATED
		},
		{
			result: { type: "dismiss" },
			outcome: ACCOUNT_ACTION_OUTCOMES.CANCELLED
		}
	])("reads how the email change ended: $outcome", async ({
		result, outcome
	}) => {
		mockOpenAuthSession.mockResolvedValue(result);

		await expect(KeycloakAuth.changeEmail({keycloakId: "current-account"})).resolves.toBe(outcome);
	});

	it.each([
		"crownicles://auth?error=access_denied&error_description=refused",
		"crownicles://auth?code=c&state=s&kc_action=UPDATE_EMAIL&kc_action_status=error"
	])("reports a Keycloak failure of the email change: %s", async url => {
		mockOpenAuthSession.mockResolvedValue({
			type: "success", url
		});

		await expect(KeycloakAuth.changeEmail({keycloakId: "current-account"})).rejects.toMatchObject({ reason: AUTH_FAILURES.UNKNOWN });
	});

	it("opens the password page in the same way, and reads that it was saved", async () => {
		mockOpenAuthSession.mockResolvedValue({
			type: "success", url: "crownicles://auth?code=c&state=s&kc_action=UPDATE_PASSWORD&kc_action_status=success"
		});

		await expect(KeycloakAuth.changePassword({keycloakId: "current-account"})).resolves.toBe(ACCOUNT_ACTION_OUTCOMES.UPDATED);
		expect(mockAuthRequestConfigs.at(-1)).toMatchObject({ extraParams: {
			kc_action: "UPDATE_PASSWORD", prompt: "login"
		} });
	});

	it.each([
		"crownicles://auth?code=c&state=wrong&kc_action=UPDATE_EMAIL&kc_action_status=success",
		"crownicles://auth?code=c&state=s&kc_action=UPDATE_PASSWORD&kc_action_status=success",
		"crownicles://auth?state=s&kc_action=UPDATE_EMAIL&kc_action_status=success"
	])("rejects an uncorrelated account action: %s", async url => {
		mockOpenAuthSession.mockResolvedValue({type: "success", url});
		await expect(KeycloakAuth.changeEmail({keycloakId: "current-account"})).rejects.toMatchObject({reason: AUTH_FAILURES.INVALID_TOKEN});
	});

	it("refuses an action Keycloak ran on another account than the one targeted", async () => {
		keycloakAnswers("account-signed-up-meanwhile");
		mockOpenAuthSession.mockResolvedValue({
			type: "success", url: "crownicles://auth?code=c&state=s&kc_action=UPDATE_PASSWORD&kc_action_status=success"
		});

		await expect(KeycloakAuth.changePassword({keycloakId: "current-account"})).rejects.toMatchObject({reason: AUTH_FAILURES.INVALID_TOKEN});
	});

	it("keeps the offline session for the game sign-in only, not for account actions", async () => {
		mockPromptAsync.mockResolvedValue({
			type: "success", params: { code: "authorization-code" }
		});
		mockOpenAuthSession.mockResolvedValue({ type: "dismiss" });

		await KeycloakAuth.login();
		await KeycloakAuth.changePassword({keycloakId: "current-account"});

		expect(mockAuthRequestConfigs.map(config => config.scopes)).toEqual([["openid", "offline_access"], ["openid"]]);
	});

	it("reads the current address from Keycloak with the session's access token", async () => {
		const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ sub: "current-account", email: "player@example.com" }), { status: 200 }));

		await expect(KeycloakAuth.accountEmail("access-token")).resolves.toBe("player@example.com");
		expect(fetch).toHaveBeenCalledWith(
			"https://keycloak.example.com/realms/crownicles/protocol/openid-connect/userinfo",
			{ headers: { Authorization: "Bearer access-token" } }
		);
	});

	it("has no address to show for an account without one", async () => {
		jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ sub: "id" }), { status: 200 }));

		await expect(KeycloakAuth.accountEmail("access-token")).resolves.toBeNull();
	});
});
