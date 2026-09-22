import { keycloakConfig } from "../../index";
import { KeycloakUtils } from "../../../../Lib/src/keycloak/KeycloakUtils";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { verifyDeletionCode } from "../../../../Lib/src/utils/AccountDeletionCode";
import { WebSocketServer } from "../WebSocketServer";
import { WEBSOCKET_ACCOUNT_DELETED_REASON } from "../../../../WsPackets/src/WebSocketCloseReasons";
import { notifyDeletionRequest } from "../AccountDeletionNotifier";
import { AccountDeletionConfig } from "../../config/RestWsConfig";
import {
	FastifyInstance, FastifyReply, FastifyRequest
} from "fastify";
import { getRequestLoggerMetadata } from "../RestApi";

/**
 * Resolves the account the request is made for.
 *
 * The account is always the one the token belongs to, never an identifier sent by the client, so a
 * valid token cannot be used to act on somebody else's account.
 * @param request
 * @param reply
 */
async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
	const header = request.headers.authorization;
	const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
	if (!token) {
		reply.status(401).send({ error: "Missing bearer token" });
		return null;
	}

	const checkToken = await KeycloakUtils.checkTokenAndGetKeycloakId(keycloakConfig, token);
	if (checkToken.isError) {
		reply.status(401).send({ error: "Invalid token" });
		return null;
	}

	return checkToken.payload.keycloakId;
}

/**
 * Registers the deletion request of a player and warns the administrator about it.
 * @param server
 * @param config
 */
function setupDeletionRequestRoute(server: FastifyInstance, config: AccountDeletionConfig): void {
	server.post("/account/deletion-request", async (request, reply) => {
		const keycloakId = await authenticate(request, reply);
		if (!keycloakId) {
			return;
		}

		const account = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, keycloakId);
		if (account.isError) {
			CrowniclesLogger.error("Could not read the account asking for its deletion", {
				apiReturn: account,
				keycloakId,
				...getRequestLoggerMetadata(request)
			});
			reply.status(500).send({ error: "Deletion request failed" });
			return;
		}

		const { user } = account.payload;
		await notifyDeletionRequest({
			keycloakId,
			username: user.attributes.gameUsername[0],
			...user.email ? { email: user.email } : {},
			...user.attributes.discordId ? { discordId: user.attributes.discordId[0] } : {}
		}, config);

		reply.send({ message: "Deletion request registered" });
	});
}

/**
 * Deletes the account once the player gives back the code they received.
 * @param server
 * @param config
 */
function setupDeletionRoute(server: FastifyInstance, config: AccountDeletionConfig): void {
	server.delete("/account", async (request, reply) => {
		const keycloakId = await authenticate(request, reply);
		if (!keycloakId) {
			return;
		}

		const { code } = (request.body ?? {}) as { code?: string };
		if (!config.SECRET || !code || !verifyDeletionCode(keycloakId, code, config.SECRET)) {
			reply.status(403).send({ error: "Invalid deletion code" });
			return;
		}

		const deletion = await KeycloakUtils.deleteUser(keycloakConfig, keycloakId);
		if (deletion.isError) {
			CrowniclesLogger.error("Failed to delete an account", {
				apiReturn: deletion,
				keycloakId,
				...getRequestLoggerMetadata(request)
			});
			reply.status(deletion.status).send({ error: "Account deletion failed" });
			return;
		}

		WebSocketServer.closeConnection(keycloakId, WEBSOCKET_ACCOUNT_DELETED_REASON);

		CrowniclesLogger.info("Account deleted", { keycloakId });
		reply.send({ message: "Account deleted" });
	});
}

/**
 * Sets up the account deletion routes for the API.
 *
 * Deletion takes two steps: the player asks for it from the app, then confirms with the code an
 * administrator sends them once the request has been checked.
 * @param server
 * @param config
 */
export function setupAccountDeletionRoutes(server: FastifyInstance, config: AccountDeletionConfig): void {
	setupDeletionRequestRoute(server, config);
	setupDeletionRoute(server, config);
}
