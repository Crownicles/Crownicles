import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";
import { ReactionCollectorEnded as LibReactionCollectorEnded } from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorEnded } from "../../../../../WsPackets/src/fromServer/common/ReactionCollectorEnded";

export default class ReactionCollectorEndedServerTranslator {
	@fromServerTranslator(LibReactionCollectorEnded, ReactionCollectorEnded)
	public static translate(_context: PacketContext, _packet: LibReactionCollectorEnded): Promise<ReactionCollectorEnded> {
		return asyncMakeFromServerPacket(ReactionCollectorEnded, {});
	}
}
