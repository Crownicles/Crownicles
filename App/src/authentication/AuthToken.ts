import {KeycloakAuth} from "@/src/authentication/KeycloakAuth";
import {KeycloakOAuth2Token} from "@/src/authentication/KeycloakOAuth2Token";

const NEVER_EXPIRES = "never" as const;

export type TokenExpiration = Date | typeof NEVER_EXPIRES;

export interface AuthTokenData {
	accessToken: string;
	refreshToken: string;
	accessTokenExpiresAt: Date;
	refreshTokenExpiresAt: TokenExpiration;
}

interface SerializedAuthTokenData {
	accessToken: string;
	refreshToken: string;
	accessTokenExpiresAt: string;
	refreshTokenExpiresAt: string | typeof NEVER_EXPIRES;
}

function expirationFromSeconds(seconds: number): TokenExpiration {
	if (seconds === 0) {
		return NEVER_EXPIRES;
	}

	return new Date(Date.now() + seconds * 1000);
}

function serializeExpiration(expiration: TokenExpiration): string {
	return expiration === NEVER_EXPIRES ? NEVER_EXPIRES : expiration.toISOString();
}

function parseExpiration(expiration: string | typeof NEVER_EXPIRES): TokenExpiration {
	return expiration === NEVER_EXPIRES ? NEVER_EXPIRES : new Date(expiration);
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
		if (this.data.refreshTokenExpiresAt === NEVER_EXPIRES) {
			return false;
		}

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
				const refreshedToken = await KeycloakAuth.refresh(this.data.refreshToken);
				this.data.accessToken = refreshedToken.access_token;
				this.data.refreshToken = refreshedToken.refresh_token;
				this.data.accessTokenExpiresAt = new Date(Date.now() + refreshedToken.expires_in * 1000);
				this.data.refreshTokenExpiresAt = expirationFromSeconds(refreshedToken.refresh_expires_in);
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
			refreshTokenExpiresAt: serializeExpiration(this.data.refreshTokenExpiresAt)
		});
	}

	public static fromJsonString(tokenString: string): AuthToken {
		try {
			const data = JSON.parse(tokenString) as SerializedAuthTokenData;
			return new AuthToken({
				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
				accessTokenExpiresAt: new Date(data.accessTokenExpiresAt),
				refreshTokenExpiresAt: parseExpiration(data.refreshTokenExpiresAt)
			});
		}
		catch {
			throw new Error("Invalid token string format");
		}
	}

	public static fromKeycloakOAuth2Token(keycloakOAuth2Token: KeycloakOAuth2Token): AuthToken {
		return new AuthToken({
			accessToken: keycloakOAuth2Token.access_token,
			refreshToken: keycloakOAuth2Token.refresh_token,
			accessTokenExpiresAt: new Date(Date.now() + keycloakOAuth2Token.expires_in * 1000),
			refreshTokenExpiresAt: expirationFromSeconds(keycloakOAuth2Token.refresh_expires_in)
		});
	}
}