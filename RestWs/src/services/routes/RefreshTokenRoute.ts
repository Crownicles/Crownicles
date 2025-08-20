import { FastifyInstance } from "fastify";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { keycloakConfig } from "../../index";
import { KeycloakUtils } from "../../../../Lib/src/keycloak/KeycloakUtils";
import { getRequestLoggerMetadata } from "../RestApi";

/**
 * Sets up the refresh token route for the API.
 * @param server
 */
export function setupRefreshTokenRoute(server: FastifyInstance): void {
	server.post("/refresh-token", async (request, reply) => {
		try {
			CrowniclesLogger.debug("Refresh token request received", {
				...getRequestLoggerMetadata(request)
			});

			// URI naming convention
			/* eslint-disable-next-line camelcase */
			const { refresh_token } = request.body as { refresh_token: string };

			// Check if the refresh token is provided
			/* eslint-disable-next-line camelcase */
			if (!refresh_token) {
				reply.status(400).send({ error: "Token is required" });
			}

			// Try to refresh the token
			const resRefresh = await KeycloakUtils.refreshUserToken(keycloakConfig, refresh_token);

			// Check if the refresh was successful
			if (resRefresh.isError) {
				// As it can be caused by a user trying to refresh a token manually, we log it as a warning instead of an error
				CrowniclesLogger.warn("Failed to refresh token", {
					apiReturn: resRefresh,
					...getRequestLoggerMetadata(request)
				});
				reply.status(resRefresh.status).send(resRefresh.payload);
				return;
			}

			// Send the new token to the user
			reply.send(resRefresh.payload);
		}
		catch (error) {
			CrowniclesLogger.errorWithObj("Error during refresh token", {
				error,
				...getRequestLoggerMetadata(request)
			});
			reply.status(500).send({ error: "Internal server error" });
		}
	});
}
