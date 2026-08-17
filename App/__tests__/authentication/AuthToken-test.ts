import {AuthToken, AuthTokenData} from "@/src/authentication/AuthToken";
import {KeycloakAuth} from "@/src/authentication/KeycloakAuth";
import {KeycloakOAuth2Token} from "@/src/authentication/KeycloakOAuth2Token";

function tokenData(overrides: Partial<AuthTokenData> = {}): AuthTokenData {
	return {
		accessToken: "access-token",
		refreshToken: "refresh-token",
		accessTokenExpiresAt: new Date(Date.now() + 60_000),
		refreshTokenExpiresAt: new Date(Date.now() + 120_000),
		...overrides
	};
}

function refreshedToken(): KeycloakOAuth2Token {
	return {
		access_token: "new-access-token",
		expires_in: 60,
		refresh_expires_in: 120,
		refresh_token: "new-refresh-token",
		token_type: "Bearer",
		session_state: "session",
		scope: "openid"
	};
}

describe("AuthToken", () => {
	afterEach((): void => {
		jest.restoreAllMocks();
	});

	it("round-trips through secure storage JSON", () => {
		const token = new AuthToken(tokenData());

		expect(AuthToken.fromJsonString(token.toJsonString()).getAccessToken()).toBe("access-token");
	});

	it("refreshes an expired access token while the refresh token is valid", async () => {
		const refresh = jest.spyOn(KeycloakAuth, "refresh").mockResolvedValue(refreshedToken());
		const token = new AuthToken(tokenData({
			accessTokenExpiresAt: new Date(Date.now() - 1)
		}));

		await expect(token.refreshIfNeeded()).resolves.toBe(true);
		expect(refresh).toHaveBeenCalledWith("refresh-token");
		expect(token.getAccessToken()).toBe("new-access-token");
	});

	it("does not refresh when both tokens are expired", async () => {
		const refresh = jest.spyOn(KeycloakAuth, "refresh");
		const token = new AuthToken(tokenData({
			accessTokenExpiresAt: new Date(Date.now() - 2),
			refreshTokenExpiresAt: new Date(Date.now() - 1)
		}));

		await expect(token.refreshIfNeeded()).resolves.toBe(false);
		expect(refresh).not.toHaveBeenCalled();
		expect(token.getAccessToken()).toBeNull();
	});
});
