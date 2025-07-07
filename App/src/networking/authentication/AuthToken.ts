import { KeycloakOAuth2Token } from "../../../../Lib/src/keycloak/KeycloakOAuth2Token";
import { RestApi } from "../RestApi.ts";

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

	public async getAccessTokenAndRefreshIfNeeded(): Promise<string | null> {
		if (this.isAccessTokenExpired()) {
			if (this.isRefreshTokenExpired()) {
				return null; // Both tokens are expired
			}

			try {
				return (await RestApi.refreshToken(this.data.refreshToken)).data.accessToken;
			}
			catch (_) {
				return null; // Refresh failed
			}
		}

		return this.data.accessToken;
	}

	public toString(): string {
		return JSON.stringify({
			accessToken: this.data.accessToken,
			refreshToken: this.data.refreshToken,
			accessTokenExpiresAt: this.data.accessTokenExpiresAt.toISOString(),
			refreshTokenExpiresAt: this.data.refreshTokenExpiresAt.toISOString()
		});
	}

	public static fromKeycloakOAuth2Token(keycloakOAuth2Token: KeycloakOAuth2Token): AuthToken {
		return new AuthToken({
			accessToken: keycloakOAuth2Token.access_token,
			refreshToken: keycloakOAuth2Token.refresh_token,
			accessTokenExpiresAt: new Date(Date.now() + keycloakOAuth2Token.expires_in * 1000),
			refreshTokenExpiresAt: new Date(Date.now() + keycloakOAuth2Token.refresh_expires_in * 1000)
		});
	}

	public static fromString(tokenString: string): AuthToken {
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
}
