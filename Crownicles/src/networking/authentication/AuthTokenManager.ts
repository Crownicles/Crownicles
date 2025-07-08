import {KeycloakOAuth2Token} from "../../../../Lib/src/keycloak/KeycloakOAuth2Token.ts";
import {AuthToken} from "./AuthToken.ts";
import * as Keychain from "react-native-keychain";

export class AuthTokenManager {
	private static readonly KEYCHAIN_USERNAME = "authToken";

	private static instance: AuthTokenManager;

	private token: AuthToken | null = null;

	private constructor() {}

	public static getInstance(): AuthTokenManager {
		if (!AuthTokenManager.instance) {
			AuthTokenManager.instance = new AuthTokenManager();
		}
		return AuthTokenManager.instance;
	}

	public async getToken(): Promise<AuthToken | null> {
		if (this.token) {
			return this.token;
		}

		try {
			const credentials = await Keychain.getGenericPassword();
			if (credentials && credentials.username === AuthTokenManager.KEYCHAIN_USERNAME && credentials.password) {
				this.token = AuthToken.fromString(credentials.password);
				return this.token;
			}
		}
		catch (error) {
			console.error("Error retrieving token from Keychain:", error);
		}

		return null;
	}

	public async setTokenFromKeycloakOAuth2Token(keycloakOAuth2Token: KeycloakOAuth2Token): Promise<AuthToken> {
		this.token = AuthToken.fromKeycloakOAuth2Token(keycloakOAuth2Token);
		await Keychain.setGenericPassword(AuthTokenManager.KEYCHAIN_USERNAME, this.token.toString());
		return this.token;
	}

	public async clearToken(): Promise<void> {
		this.token = null;
		await Keychain.resetGenericPassword();
	}
}
