import {
	IDENTITY_PROVIDERS, KeycloakAuth
} from "@/src/authentication/KeycloakAuth";
import {KeycloakOAuth2Token} from "@/src/authentication/KeycloakOAuth2Token";
import {AUTH_FAILURES} from "@/src/authentication/AuthFailure";

const mockPromptAsync = jest.fn();
const mockAuthRequestConfigs: Record<string, unknown>[] = [];

jest.mock("expo-auth-session", () => ({
	AuthRequest: class {
		public codeVerifier = "code-verifier";

		public promptAsync = mockPromptAsync;

		public constructor(config: Record<string, unknown>) {
			mockAuthRequestConfigs.push(config);
		}
	},
	makeRedirectUri: (): string => "crownicles://auth",
	ResponseType: {Code: "code"}
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

describe("KeycloakAuth", () => {
	beforeEach((): void => {
		process.env.EXPO_PUBLIC_KEYCLOAK_URL = "https://keycloak.example.com";
		process.env.EXPO_PUBLIC_KEYCLOAK_REALM = "crownicles";
		process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID = "crownicles-app";
		mockAuthRequestConfigs.length = 0;
		mockPromptAsync.mockReset();
	});

	afterEach((): void => {
		jest.restoreAllMocks();
	});

	it("accepts Keycloak offline token responses without a refresh expiry", async () => {
		const token = offlineToken();
		const response = new Response(JSON.stringify(token), {status: 200});
		const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(response);

		await expect(KeycloakAuth.refresh("refresh-token")).resolves.toEqual(token);
		expect(fetch).toHaveBeenCalledWith(
			"https://keycloak.example.com/realms/crownicles/protocol/openid-connect/token",
			expect.objectContaining({method: "POST"})
		);
	});

	it("names the provider so Keycloak skips its picker", async () => {
		mockPromptAsync.mockResolvedValue({
			type: "success",
			params: {code: "authorization-code"}
		});
		jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(offlineToken()), {status: 200}));

		await KeycloakAuth.login(IDENTITY_PROVIDERS.DISCORD);

		expect(mockAuthRequestConfigs.at(-1)).toMatchObject({extraParams: {kc_idp_hint: "discord"}});
	});

	it("leaves the choice to Keycloak when no provider is named", async () => {
		mockPromptAsync.mockResolvedValue({
			type: "success",
			params: {code: "authorization-code"}
		});
		jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(offlineToken()), {status: 200}));

		await KeycloakAuth.login();

		expect(mockAuthRequestConfigs.at(-1)?.extraParams).not.toHaveProperty("kc_idp_hint");
	});

	it("asks Keycloak for the pages in the language of the app", async () => {
		mockPromptAsync.mockResolvedValue({
			type: "success",
			params: {code: "authorization-code"}
		});
		jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(offlineToken()), {status: 200}));

		await KeycloakAuth.login();

		expect(mockAuthRequestConfigs.at(-1)).toMatchObject({extraParams: {ui_locales: "fr"}});
	});

	it("reports a cancellation as such rather than as a failure", async () => {
		mockPromptAsync.mockResolvedValue({type: "dismiss"});

		await expect(KeycloakAuth.login()).rejects.toMatchObject({reason: AUTH_FAILURES.CANCELLED});
	});

	it("reports an unusable token without leaking the protocol wording", async () => {
		mockPromptAsync.mockResolvedValue({
			type: "success",
			params: {code: "authorization-code"}
		});
		jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({access_token: "only-this"}), {status: 200}));

		await expect(KeycloakAuth.login()).rejects.toMatchObject({reason: AUTH_FAILURES.INVALID_TOKEN});
	});
});
