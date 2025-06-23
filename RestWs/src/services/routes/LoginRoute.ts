import {
	FastifyInstance, FastifyReply, FastifyRequest
} from "fastify";
import { KeycloakUtils } from "../../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../../index";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { RegisteringConstants } from "../../constants/RegisteringConstants";
import { getRequestLoggerMetadata } from "../RestApi";

/**
 * Verifies if the user is in the beta login group.
 * @param req
 * @param keycloakId
 * @param reply
 */
export async function betaLoginVerifyGroup(req: FastifyRequest, keycloakId: string, reply: FastifyReply): Promise<boolean> {
	const groups = await KeycloakUtils.getUserGroups(keycloakConfig, keycloakId);
	if (groups.isError) {
		CrowniclesLogger.error("Failed to get user groups", {
			apiReturn: groups,
			keycloakId,
			...getRequestLoggerMetadata(req)
		});
		reply.status(groups.status).send(groups.payload);
		return false;
	}

	if (!groups.payload.groups.includes(RegisteringConstants.BETA_GROUP)) {
		CrowniclesLogger.error("User is not in the beta group", {
			apiReturn: groups,
			keycloakId,
			...getRequestLoggerMetadata(req)
		});
		reply.status(403).send({ error: "You are not allowed to use this endpoint" });
		return false;
	}

	return true;
}

/**
 * Sets up the login route for the API.
 * @param server
 * @param betaLogin
 */
export function setupLoginRoute(server: FastifyInstance, betaLogin: boolean): void {
	server.post("/login", async (request, reply) => {
		try {
			CrowniclesLogger.debug("Login request received", {
				...getRequestLoggerMetadata(request)
			});

			// Extract credentials from the request body
			const {
				username,
				password
			} = request.body as {
				username?: string;
				password?: string;
			};

			// Check if the credentials are provided
			if (!username || !password) {
				reply.status(400).send({ error: "Username and password are required" });
				return;
			}

			// Try to log in the user
			const res = await KeycloakUtils.loginUser(keycloakConfig, username, password);

			// An error occurred during login
			if (res.isError) {
				CrowniclesLogger.warn("Failed to login user", {
					apiReturn: res,
					username,
					...getRequestLoggerMetadata(request)
				});
				reply.status(res.status).send(res.payload);
				return;
			}

			// The login was successful, but test if the user is in the beta group
			if (betaLogin) {
				const user = await KeycloakUtils.checkTokenAndGetKeycloakId(keycloakConfig, res.payload.access_token);
				if (user.isError) {
					CrowniclesLogger.error("Failed to get user info", {
						apiReturn: user,
						username,
						...getRequestLoggerMetadata(request)
					});
					reply.status(user.status).send(user.payload);
					return;
				}

				if (await betaLoginVerifyGroup(request, user.payload.keycloakId, reply)) {
					CrowniclesLogger.info("Beta user logged in", {
						apiReturn: user,
						username,
						...getRequestLoggerMetadata(request)
					});
					reply.send(res.payload);
				}

				return;
			}

			// The login was successful and the user is not in the beta group, so just send the response
			CrowniclesLogger.info("User logged in", {
				apiReturn: res,
				username
			});
			reply.send(res.payload);
		}
		catch (error) {
			CrowniclesLogger.errorWithObj("Error during login", {
				error,
				...getRequestLoggerMetadata(request)
			});
			reply.status(500).send({ error });
		}
	});
}
