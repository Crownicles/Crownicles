import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { ReactionCollectorCreationPacket } from "../interaction/ReactionCollectorPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandGetCurrentReactionCollectorsPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandGetCurrentReactionCollectorsPacketRes extends CrowniclesPacket {
	collectors!: ReactionCollectorCreationPacket[];
}
