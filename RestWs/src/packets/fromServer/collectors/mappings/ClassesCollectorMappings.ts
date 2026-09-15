import {
	ReactionCollectorChangeClassData, ReactionCollectorChangeClassReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorChangeClass";
import {
	CLASSES_DATA_KINDS, CLASSES_REACTION_KINDS
} from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping, defineDataMapping, defineReactionMapping, ReactionMapping
} from "../CollectorMapping";

export const classesDataMappings: DataMapping[] = [
	defineDataMapping(ReactionCollectorChangeClassData, CLASSES_DATA_KINDS.COLLECTOR, data => ({
		classesDetails: data.classesDetails, cooldownSeconds: data.cooldownSeconds
	}))
];
export const classesReactionMappings: ReactionMapping[] = [defineReactionMapping(ReactionCollectorChangeClassReaction, CLASSES_REACTION_KINDS.CHOOSE, reaction => ({ classId: reaction.classId }))];
