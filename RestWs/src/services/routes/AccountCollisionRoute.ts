import {
	FastifyInstance, FastifyReply, FastifyRequest
} from "fastify";
import { keycloakConfig } from "../../index";
import {
	AccountCollisionFailure, AccountCollisionService
} from "../AccountCollisionService";
import {
	ACCOUNT_COLLISION_CHOICES, ACCOUNT_COLLISION_ENDPOINTS, ACCOUNT_COLLISION_ERRORS, AccountCollisionChoice
} from "../../../../WsPackets/src/objects/AccountCollision";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { WebSocketServer } from "../WebSocketServer";
import { WEBSOCKET_ACCOUNT_DELETED_REASON } from "../../../../WsPackets/src/WebSocketCloseReasons";

type VerifyBody = { emailToken: string };
type ResolveBody = {
	proof: string; keep: AccountCollisionChoice;
};

function bearerToken(request: FastifyRequest): string {
	const header = request.headers.authorization;
	return header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

async function respond(reply: FastifyReply, action: () => Promise<object>): Promise<void> {
	try {
		reply.send(await action());
	}
	catch (error) {
		if (error instanceof AccountCollisionFailure) {
			reply.status(error.status).send({ error: error.reason });
			return;
		}
		CrowniclesLogger.error("Account collision resolution failed");
		reply.status(503).send({ error: ACCOUNT_COLLISION_ERRORS.UNAVAILABLE });
	}
}

export function setupAccountCollisionRoutes(
	server: FastifyInstance,
	service: AccountCollisionService = new AccountCollisionService(keycloakConfig, id => WebSocketServer.closeConnection(id, WEBSOCKET_ACCOUNT_DELETED_REASON))
): void {
	server.get(ACCOUNT_COLLISION_ENDPOINTS.CHECK, async (request, reply): Promise<void> => {
		await respond(reply, () => service.check(bearerToken(request)));
	});
	server.post<{ Body: VerifyBody }>(ACCOUNT_COLLISION_ENDPOINTS.VERIFY, {
		schema: { body: {
			type: "object",
			required: ["emailToken"],
			additionalProperties: false,
			properties: { emailToken: {
				type: "string", minLength: 1
			} }
		} }
	}, async (request, reply): Promise<void> => {
		await respond(reply, () => service.verify(bearerToken(request), request.body.emailToken));
	});
	server.post<{ Body: ResolveBody }>(ACCOUNT_COLLISION_ENDPOINTS.RESOLVE, {
		schema: { body: {
			type: "object",
			required: ["proof", "keep"],
			additionalProperties: false,
			properties: {
				proof: { type: "string" },
				keep: {
					type: "string", enum: Object.values(ACCOUNT_COLLISION_CHOICES)
				}
			}
		} }
	}, async (request, reply): Promise<void> => {
		await respond(reply, () => service.resolve(bearerToken(request), request.body.proof, request.body.keep));
	});
}
