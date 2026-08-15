import * as AuthSession from "expo-auth-session";
import {KeycloakOAuth2Token} from "@/src/authentication/KeycloakOAuth2Token";

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

function getDiscovery(): AuthSession.DiscoveryDocument {
	const realmUrl = getRealmUrl();
	return {
		authorizationEndpoint: `${realmUrl}/protocol/openid-connect/auth`,
		tokenEndpoint: `${realmUrl}/protocol/openid-connect/token`,
		endSessionEndpoint: `${realmUrl}/protocol/openid-connect/logout`
	};
}

function getRedirectUri(): string {
	return AuthSession.makeRedirectUri({
		scheme: "crownicles",
		path: "auth"
	});
}

/**
 * Authenticates against Keycloak with Authorization Code + PKCE.
 *
 * Keycloak brokers the actual identity providers (Discord today, others later), so this flow stays
 * the same whichever provider the player picks on the Keycloak login page.
 */
export class KeycloakAuth {
	public static async login(): Promise<KeycloakOAuth2Token> {
		const redirectUri = getRedirectUri();
		const request = new AuthSession.AuthRequest({
			clientId: getClientId(),
			redirectUri,
			scopes: ["openid"],
			responseType: AuthSession.ResponseType.Code,
			usePKCE: true
		});

		const result = await request.promptAsync(getDiscovery());

		if (result.type !== "success") {
			throw new Error(`Login was not completed: ${result.type}`);
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
			throw new Error(`Keycloak token request failed with status ${response.status}`);
		}

		const token = await response.json() as KeycloakOAuth2Token;

		if (!token.access_token || !token.refresh_token || !token.expires_in || !token.refresh_expires_in) {
			throw new Error("Keycloak returned an incomplete token.");
		}

		return token;
	}
}
