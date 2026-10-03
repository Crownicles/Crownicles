import { ReactionCollectorCreation } from "../common/ReactionCollectorCreation";
import { FromServerPacket } from "../FromServerPacket";

export class CommandGetCurrentReactionCollectorsRes extends FromServerPacket {
	public static readonly wireName = "CommandGetCurrentReactionCollectorsRes";

	collectors!: ReactionCollectorCreation[];
}
