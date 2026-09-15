import {KeycloakAuth} from "@/src/authentication/KeycloakAuth";
import {KeycloakOAuth2Token} from "@/src/authentication/KeycloakOAuth2Token";

function offlineToken(): KeycloakOAuth2Token {
	return {
		access_token: "access-token",
		expires_in: 300,
		refresh_expires_in: 0,
		refresh_token: "refresh-token",
		token_type: "Bearer",
		session_state: "session",
		scope: "openid offline_access"
	};
}

describe("KeycloakAuth", () => {
	afterEach((): void => {
		jest.restoreAllMocks();
	});

	it("accepts Keycloak offline token responses without a refresh expiry", async () => {
		process.env.EXPO_PUBLIC_KEYCLOAK_URL = "https://keycloak.example.com";
		process.env.EXPO_PUBLIC_KEYCLOAK_REALM = "crownicles";
		process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID = "crownicles-app";
		const token = offlineToken();
		const response = new Response(JSON.stringify(token), {status: 200});
		const fetch = jest.spyOn(globalThis, "fetch").mockResolvedValue(response);

		await expect(KeycloakAuth.refresh("refresh-token")).resolves.toEqual(token);
		expect(fetch).toHaveBeenCalledWith(
			"https://keycloak.example.com/realms/crownicles/protocol/openid-connect/token",
			expect.objectContaining({method: "POST"})
		);
	});
});