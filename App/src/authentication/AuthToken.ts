import {RestApi} from "@/src/networking/RestApi";
import {KeycloakOAuth2Token} from "../../../Lib/src/keycloak/KeycloakOAuth2Token";

export interface AuthTokenData {
	accessToken: string;
	refreshToken: string;
	accessTokenExpiresAt: Date;
	refreshTokenExpiresAt: Date;
}

export class AuthToken {
	private data: AuthTokenData;

	constructor(data: AuthTokenData) {
		this.data = data;
	}

	private isAccessTokenExpired(): boolean {
		return Date.now() >= this.data.accessTokenExpiresAt.getTime();
	}

	private isRefreshTokenExpired(): boolean {
		return Date.now() >= this.data.refreshTokenExpiresAt.getTime();
	}

	public getAccessToken(): string | null {
		if (this.isAccessTokenExpired()) {
			return null;
		}
		return this.data.accessToken;
	}

	/**
	 * Checks if the access token is valid and not expired.
	 * @return {boolean} True if the access token has been refreshed, false otherwise.
	 */
	public async refreshIfNeeded(): Promise<boolean> {
		if (this.isAccessTokenExpired() && !this.isRefreshTokenExpired()) {
			try {
				let refreshedToken = await RestApi.refreshToken(this.data.refreshToken);
				this.data.accessToken = refreshedToken.access_token;
				this.data.refreshToken = refreshedToken.refresh_token;
				this.data.accessTokenExpiresAt = new Date(Date.now() + refreshedToken.expires_in * 1000);
				this.data.refreshTokenExpiresAt = new Date(Date.now() + refreshedToken.refresh_expires_in * 1000);
				return true; // Refresh successful
			}
			catch {
				// Ignore
			}
		}

		return false; // Access token is still valid
	}

	public toJsonString(): string {
		return JSON.stringify({
			accessToken: this.data.accessToken,
			refreshToken: this.data.refreshToken,
			accessTokenExpiresAt: this.data.accessTokenExpiresAt.toISOString(),
			refreshTokenExpiresAt: this.data.refreshTokenExpiresAt.toISOString()
		});
	}

	public static fromJsonString(tokenString: string): AuthToken {
		try {
			const data = JSON.parse(tokenString) as AuthTokenData;
			return new AuthToken({
				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
				accessTokenExpiresAt: new Date(data.accessTokenExpiresAt),
				refreshTokenExpiresAt: new Date(data.refreshTokenExpiresAt)
			});
		}
		catch (_) {
			throw new Error("Invalid token string format");
		}
	}

	public static fromKeycloakOAuth2Token(keycloakOAuth2Token: KeycloakOAuth2Token): AuthToken {
		return new AuthToken({
			accessToken: keycloakOAuth2Token.access_token,
			refreshToken: keycloakOAuth2Token.refresh_token,
			accessTokenExpiresAt: new Date(Date.now() + keycloakOAuth2Token.expires_in * 1000),
			refreshTokenExpiresAt: new Date(Date.now() + keycloakOAuth2Token.refresh_expires_in * 1000)
		});
	}
}