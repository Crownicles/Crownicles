import * as WebBrowser from 'expo-web-browser';
import {WebBrowserAuthSessionResult} from 'expo-web-browser';
import {KeycloakOAuth2Token} from "../../../Lib/src/keycloak/KeycloakOAuth2Token";

export class RestApi {
	private static getBaseUrl(): string {
		const url = process.env.EXPO_PUBLIC_REST_API_URL;
		if (!url) {
			throw new Error("REST_API_URL is not defined in the environment variables.");
		}
		return url;
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

	public static loginWithDiscord(): Promise<WebBrowserAuthSessionResult> {
		return WebBrowser.openAuthSessionAsync(`${RestApi.getBaseUrl()}/discord`, "crownicles://discord");
	}

	public static async refreshToken(refreshToken: string): Promise<KeycloakOAuth2Token> {
		const response = await RestApi.post<KeycloakOAuth2Token>("/refresh-token", {
			// Naming convention
			refresh_token: refreshToken
		});

		if (!response || !response.access_token || !response.refresh_token) {
			throw new Error("Failed to refresh token: Invalid response from server.");
		}

		return response;
	}
}