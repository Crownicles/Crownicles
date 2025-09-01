import {ReactionCollectorCreation} from "../common/ReactionCollectorCreation";
import {FromServerPacket} from "../FromServerPacket";

export class CommandGetCurrentReactionCollectorsRes extends FromServerPacket {
	collectors!: ReactionCollectorCreation[];
}