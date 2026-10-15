import { FastifyInstance } from "fastify";
import {
	APP_PROTOCOL_VERSION, AppCompatibility
} from "../../../../WsPackets/src/AppCompatibility";

/** Lets the app tell, before logging in, whether it can play with this server. */
export function setupAppCompatibilityRoutes(server: FastifyInstance): void {
	server.get("/app/compatibility", (_request, reply) => {
		const compatibility: AppCompatibility = { protocolVersion: APP_PROTOCOL_VERSION };
		reply.status(200).send(compatibility);
	});
}
