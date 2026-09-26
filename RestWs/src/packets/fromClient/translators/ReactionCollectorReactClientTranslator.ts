import { fromClientTranslator } from "../FromClientTranslator";
import {
	asyncMakePacket, PacketContext
} from "../../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorReactPacket } from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorReactReq } from "../../../../../WsPackets/src/fromClient/ReactionCollectorReactReq";
import { InvalidClientPacketError } from "../InvalidClientPacketError";

export default class ReactionCollectorReactClientTranslator {
	@fromClientTranslator(ReactionCollectorReactReq)
	public static translate(context: PacketContext, packet: ReactionCollectorReactReq): Promise<ReactionCollectorReactPacket> {
		/*
		 * Taken from the authenticated connection, never from the packet: this is what stops a client
		 * from answering a collector opened for somebody else. Core then checks that this player is
		 * actually allowed to answer that collector.
		 */
		if (!context.keycloakId) {
			return Promise.reject(new InvalidClientPacketError("Reaction received on an unauthenticated connection"));
		}

		/*
		 * Core only checks the bounds of the index, so a fractional one would pass its filter and then
		 * dereference a reaction that does not exist.
		 */
		if (!Number.isInteger(packet.reactionIndex) || packet.reactionIndex < 0) {
			return Promise.reject(new InvalidClientPacketError(`Reaction index is not a positive integer: ${packet.reactionIndex}`));
		}

		if (typeof packet.collectorId !== "string") {
			return Promise.reject(new InvalidClientPacketError("Reaction carries no collector identifier"));
		}

		return asyncMakePacket(ReactionCollectorReactPacket, {
			id: packet.collectorId,
			keycloakId: context.keycloakId,
			reactionIndex: packet.reactionIndex
		});
	}
}
