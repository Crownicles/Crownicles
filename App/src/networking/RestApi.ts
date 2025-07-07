import Config from "react-native-config";
import InAppBrowser, {
	BrowserResult, RedirectResult
} from "react-native-inappbrowser-reborn";
import { KeycloakOAuth2Token } from "../../../Lib/src/keycloak/KeycloakOAuth2Token";
import { AuthToken } from "./authentication/AuthToken.ts";
import { AuthTokenManager } from "./authentication/AuthTokenManager.ts";

export class RestApi {
	private static getBaseUrl(): string {
		if (!Config.REST_API_URL) {
			throw new Error("REST_API_URL is not defined in the environment variables.");
		}
		return Config.REST_API_URL;
	}

	private static async get<T>(endpoint: string, headers: Record<string, string> = {}): Promise<T> {
		const response = await fetch(`${RestApi.getBaseUrl()}/${endpoint}`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				...headers
			}
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		return await response.json() as Promise<T>;
	}

	private static async post<T>(endpoint: string, body: object, headers: Record<string, string> = {}): Promise<T> {
		const response = await fetch(`${RestApi.getBaseUrl()}/${endpoint}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...headers
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		return await response.json() as Promise<T>;
	}

	public static loginWithDiscord(): Promise<RedirectResult | BrowserResult> {
		return InAppBrowser.openAuth(`${RestApi.getBaseUrl()}/discord`, "crownicles://discord", {
			enableUrlBarHiding: true,
			showTitle: false,
			enableDefaultShare: false
		});
	}

	// todo handle errors
	public static async loginWithUsernameAndPassword(username: string, password: string): Promise<AuthToken> {
		const response = await RestApi.post<KeycloakOAuth2Token>("/login", {
			username,
			password
		});

		if (!response || !response.access_token || !response.refresh_token) {
			throw new Error("Failed to login: Invalid response from server.");
		}

		return await AuthTokenManager.getInstance().setTokenFromKeycloakOAuth2Token(response);
	}

	// todo handle errors
	public static async refreshToken(refreshToken: string): Promise<AuthToken> {
		const response = await RestApi.post<KeycloakOAuth2Token>("/refresh-token", {
			// Naming convention
			// eslint-disable-next-line camelcase
			refresh_token: refreshToken
		});

		if (!response || !response.access_token || !response.refresh_token) {
			throw new Error("Failed to refresh token: Invalid response from server.");
		}

		return await AuthTokenManager.getInstance().setTokenFromKeycloakOAuth2Token(response);
	}
}
