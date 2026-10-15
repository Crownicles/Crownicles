import {
	FastifyReply, FastifyRequest, HookHandlerDoneFunction
} from "fastify";
import {
	APP_COMPATIBILITY_STATUSES, APP_PROTOCOL_HEADER, APP_PROTOCOL_VERSION, AppCompatibilityStatus, AppIncompatibility, compareProtocolVersions
} from "../../../WsPackets/src/AppCompatibility";

const HTTP_UPGRADE_REQUIRED = 426;

/** How an app announcing this protocol version stands; one announcing nothing predates the check, so it is behind. */
export function announcedCompatibility(announced: string | string[] | null | undefined): AppCompatibilityStatus {
	return compareProtocolVersions(Number(announced) || 0, APP_PROTOCOL_VERSION);
}

/** Refuses a request from an app speaking another protocol before its body is even read, as the WebSocket does. */
export function requireAppProtocol(request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void {
	const compatibility = announcedCompatibility(request.headers[APP_PROTOCOL_HEADER]);
	if (compatibility === APP_COMPATIBILITY_STATUSES.UP_TO_DATE) {
		done();
		return;
	}
	const refusal: AppIncompatibility = { error: compatibility };
	reply.status(HTTP_UPGRADE_REQUIRED).send(refusal);
}
