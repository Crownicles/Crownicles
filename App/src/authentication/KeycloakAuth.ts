import {
	AuthRequest,
	makeRedirectUri,
	ResponseType,
	type AuthRequestPromptOptions,
	type DiscoveryDocument
} from "expo-auth-session";
import {KeycloakOAuth2Token} from "@/src/authentication/KeycloakOAuth2Token";
import {
	AUTH_FAILURES, AuthFailure, failureOfAuthResult
} from "@/src/authentication/AuthFailure";
import {Theme} from "@/src/design/Theme";
import {currentLanguage} from "@/src/translations/i18nLoader";

/**
 * Aliases of the identity providers declared in the realm.
 *
 * Naming one lets the app skip the Keycloak provider picker, which is the only reason it has to
 * know them at all: adding a provider to the realm still requires no change here.
 */
export const IDENTITY_PROVIDERS = {
	DISCORD: "discord"
} as const;

export type IdentityProvider = typeof IDENTITY_PROVIDERS[keyof typeof IDENTITY_PROVIDERS];

/**
 * Dressing of the in-app browser that shows the Keycloak pages.
 *
 * iOS ignores every one of these: its auth session is an `ASWebAuthenticationSession`, already
 * presented as a sheet and offering no styling. They shape the Android custom tab, whose default
 * chrome would otherwise announce a website in the middle of the game.
 */
const BROWSER_PRESENTATION: AuthRequestPromptOptions = {
	toolbarColor: Theme.colors.paper,
	controlsColor: Theme.colors.ink,
	showTitle: false
};

// Expo inlines the EXPO_PUBLIC_ variables at build time, so each one has to be read literally.
function requireEnv(value: string | undefined, name: string): string {
	if (!value) {
		throw new Error(`${name} is not defined in the environment variables.`);
	}
	return value;
}

function getClientId(): string {
	return requireEnv(process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID, "EXPO_PUBLIC_KEYCLOAK_CLIENT_ID");
}

function getRealmUrl(): string {
	const url = requireEnv(process.env.EXPO_PUBLIC_KEYCLOAK_URL, "EXPO_PUBLIC_KEYCLOAK_URL");
	const realm = requireEnv(process.env.EXPO_PUBLIC_KEYCLOAK_REALM, "EXPO_PUBLIC_KEYCLOAK_REALM");
	return `${url}/realms/${realm}`;
}

function getDiscovery(): DiscoveryDocument {
	const realmUrl = getRealmUrl();
	return {
		authorizationEndpoint: `${realmUrl}/protocol/openid-connect/auth`,
		tokenEndpoint: `${realmUrl}/protocol/openid-connect/token`,
		endSessionEndpoint: `${realmUrl}/protocol/openid-connect/logout`
	};
}

function getRedirectUri(): string {
	return makeRedirectUri({
		scheme: "crownicles",
		path: "auth"
	});
}

function hasCompleteToken(token: KeycloakOAuth2Token): boolean {
	return Boolean(token.access_token && token.refresh_token)
		&& Number.isFinite(token.expires_in)
		&& token.expires_in > 0
		&& Number.isFinite(token.refresh_expires_in)
		&& token.refresh_expires_in >= 0;
}

/**
 * Authenticates against Keycloak with Authorization Code + PKCE.
 *
 * Keycloak brokers the actual identity providers (Discord today, others later), so this flow stays
 * the same whichever provider the player picks. Naming one sends them straight to it.
 */
export class KeycloakAuth {
	public static async login(identityProvider?: IdentityProvider): Promise<KeycloakOAuth2Token> {
		const redirectUri = getRedirectUri();
		// Typed as a string, but i18next answers nothing until it has loaded its resources, and
		// login is reachable before that.
		const language = currentLanguage() as string | undefined;
		const request = new AuthRequest({
			clientId: getClientId(),
			redirectUri,
			scopes: ["openid", "offline_access"],
			responseType: ResponseType.Code,
			usePKCE: true,
			extraParams: {
				// Keycloak falls back to the realm default without this, so its pages would ignore
				// the language the player already chose in the app.
				...language ? {ui_locales: language} : {},
				...identityProvider ? {kc_idp_hint: identityProvider} : {}
			}
		});

		const result = await request.promptAsync(getDiscovery(), BROWSER_PRESENTATION);

		if (result.type !== "success") {
			throw failureOfAuthResult(result);
		}

		return KeycloakAuth.requestToken({
			grant_type: "authorization_code",
			code: result.params.code,
			redirect_uri: redirectUri,
			code_verifier: request.codeVerifier ?? ""
		});
	}

	public static refresh(refreshToken: string): Promise<KeycloakOAuth2Token> {
		return KeycloakAuth.requestToken({
			grant_type: "refresh_token",
			refresh_token: refreshToken
		});
	}

	// Queried directly instead of through expo-auth-session, whose token model drops the
	// refresh_expires_in field that the app needs to know when a re-login is required.
	private static async requestToken(params: Record<string, string>): Promise<KeycloakOAuth2Token> {
		const response = await fetch(`${getRealmUrl()}/protocol/openid-connect/token`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			},
			body: new URLSearchParams({
				client_id: getClientId(),
				...params
			}).toString()
		});

		if (!response.ok) {
			throw new AuthFailure(AUTH_FAILURES.UNREACHABLE, `Keycloak token request failed with status ${response.status}`);
		}

		const token = await response.json() as KeycloakOAuth2Token;

		if (!hasCompleteToken(token)) {
			throw new AuthFailure(AUTH_FAILURES.INVALID_TOKEN, "Keycloak returned an incomplete token.");
		}

		return token;
	}
}
