import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import {
	REACTION_COLLECTOR_STOP_REASONS,
	ReactionCollectorStopPacket,
	ReactionCollectorStopReason
} from "../../../../../Lib/src/packets/interaction/ReactionCollectorStopPacket";
import {
	COLLECTOR_STOP_REASONS,
	CollectorStopReason,
	ReactionCollectorStop
} from "../../../../../WsPackets/src/fromServer/common/ReactionCollectorStop";

/**
 * Maps the back-end reason onto the protocol one. The exhaustive switch is what makes a new back-end
 * reason a compilation error here, instead of an unknown value reaching installed clients.
 * @param reason
 */
function toProtocolReason(reason: ReactionCollectorStopReason): CollectorStopReason {
	switch (reason) {
		case REACTION_COLLECTOR_STOP_REASONS.EXPIRED:
			return COLLECTOR_STOP_REASONS.EXPIRED;
		case REACTION_COLLECTOR_STOP_REASONS.RESOLVED:
			return COLLECTOR_STOP_REASONS.RESOLVED;
		default: {
			const unhandled: never = reason;
			return unhandled;
		}
	}
}

export default class ReactionCollectorStopServerTranslator {
	@fromServerTranslator(ReactionCollectorStopPacket, ReactionCollectorStop)
	public static translate(_context: PacketContext, packet: ReactionCollectorStopPacket): Promise<ReactionCollectorStop> {
		return asyncMakeFromServerPacket(ReactionCollectorStop, {
			collectorId: packet.id,
			reason: toProtocolReason(packet.reason)
		});
	}
}
