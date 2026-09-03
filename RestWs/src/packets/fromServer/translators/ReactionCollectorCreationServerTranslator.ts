import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { ReactionCollectorCreationPacket } from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorCreation } from "../../../../../WsPackets/src/fromServer/common/ReactionCollectorCreation";
import { mapCollectorCreation } from "../collectors/ReactionCollectorMapper";

export default class ReactionCollectorCreationServerTranslator {
	@fromServerTranslator(ReactionCollectorCreationPacket, ReactionCollectorCreation)
	public static translate(_context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorCreation> {
		return Promise.resolve(mapCollectorCreation(packet));
	}
}
