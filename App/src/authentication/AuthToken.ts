import { KeycloakAuth } from "@/src/authentication/KeycloakAuth";
import { KeycloakOAuth2Token } from "@/src/authentication/KeycloakOAuth2Token";
import {
	AUTH_FAILURES, AuthFailure
} from "@/src/authentication/AuthFailure";

const REFRESH_TOKEN_NEVER_EXPIRES = "never";

export interface AuthTokenData {
	accessToken: string;
	refreshToken: string;
	accessTokenExpiresAt: Date;
	refreshTokenExpiresAt: Date | typeof REFRESH_TOKEN_NEVER_EXPIRES;
}

export class AuthToken {
	private data: AuthTokenData;

	private refreshing: Promise<boolean> | null = null;

	constructor(data: AuthTokenData) {
		this.data = data;
	}

	private isAccessTokenExpired(): boolean {
		return Date.now() >= this.data.accessTokenExpiresAt.getTime();
	}

	private isRefreshTokenExpired(): boolean {
		return this.data.refreshTokenExpiresAt !== REFRESH_TOKEN_NEVER_EXPIRES
			&& Date.now() >= this.data.refreshTokenExpiresAt.getTime();
	}

	public getAccessToken(): string | null {
		if (this.isAccessTokenExpired()) {
			return null;
		}
		return this.data.accessToken;
	}

	/**
	 * Checks if the access token is valid and not expired.
	 * @returns True if the access token has been refreshed, false otherwise.
	 */
	public refreshIfNeeded(): Promise<boolean> {
		if (this.refreshing) {
			return this.refreshing;
		}
		if (!this.isAccessTokenExpired() || this.isRefreshTokenExpired()) {
			return Promise.resolve(false);
		}
		this.refreshing = KeycloakAuth.refresh(this.data.refreshToken).then(refreshedToken => {
			this.data.accessToken = refreshedToken.access_token;
			this.data.refreshToken = refreshedToken.refresh_token;
			this.data.accessTokenExpiresAt = new Date(Date.now() + refreshedToken.expires_in * 1000);
			this.data.refreshTokenExpiresAt = refreshedToken.refresh_expires_in === 0
				? REFRESH_TOKEN_NEVER_EXPIRES
				: new Date(Date.now() + refreshedToken.refresh_expires_in * 1000);
			return true;
		})
			.finally((): void => {
				this.refreshing = null;
			});
		return this.refreshing;
	}

	public toJsonString(): string {
		return JSON.stringify({
			accessToken: this.data.accessToken,
			refreshToken: this.data.refreshToken,
			accessTokenExpiresAt: this.data.accessTokenExpiresAt.toISOString(),
			refreshTokenExpiresAt: this.data.refreshTokenExpiresAt === REFRESH_TOKEN_NEVER_EXPIRES
				? REFRESH_TOKEN_NEVER_EXPIRES
				: this.data.refreshTokenExpiresAt.toISOString()
		});
	}

	public static fromJsonString(tokenString: string): AuthToken {
		try {
			const data = JSON.parse(tokenString) as AuthTokenData;
			return new AuthToken({
				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
				accessTokenExpiresAt: new Date(data.accessTokenExpiresAt),
				refreshTokenExpiresAt: data.refreshTokenExpiresAt === REFRESH_TOKEN_NEVER_EXPIRES
					? REFRESH_TOKEN_NEVER_EXPIRES
					: new Date(data.refreshTokenExpiresAt)
			});
		}
		catch {
			// A write interrupted between two keychain parts leaves a session nobody can use: it is to be signed in again.
			throw new AuthFailure(AUTH_FAILURES.INVALID_TOKEN, "Invalid token string format");
		}
	}

	public static fromKeycloakOAuth2Token(keycloakOAuth2Token: KeycloakOAuth2Token): AuthToken {
		return new AuthToken({
			accessToken: keycloakOAuth2Token.access_token,
			refreshToken: keycloakOAuth2Token.refresh_token,
			accessTokenExpiresAt: new Date(Date.now() + keycloakOAuth2Token.expires_in * 1000),
			refreshTokenExpiresAt: keycloakOAuth2Token.refresh_expires_in === 0
				? REFRESH_TOKEN_NEVER_EXPIRES
				: new Date(Date.now() + keycloakOAuth2Token.refresh_expires_in * 1000)
		});
	}
}
