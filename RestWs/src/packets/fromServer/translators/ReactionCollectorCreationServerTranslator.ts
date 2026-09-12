import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCreationPacket } from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorCreation } from "../../../../../WsPackets/src/fromServer/common/ReactionCollectorCreation";
import { mapCollectorDisplay } from "../collectors/CollectorDisplayMapper";

export default class ReactionCollectorCreationServerTranslator {
	@fromServerTranslator(ReactionCollectorCreationPacket, ReactionCollectorCreation)
	public static translate(_context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorCreation> {
		return mapCollectorDisplay(packet);
	}
}
