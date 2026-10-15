import {
	ReactionCollectorBigEventData,
	ReactionCollectorBigEventPossibilityReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorBigEvent";
import {
	BIG_EVENT_DATA_KINDS, BIG_EVENT_REACTION_KINDS
} from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping, defineDataMapping, defineReactionMapping, ReactionMapping
} from "../CollectorMapping";

export const bigEventReactionMappings: ReactionMapping[] = [
	defineReactionMapping(ReactionCollectorBigEventPossibilityReaction, BIG_EVENT_REACTION_KINDS.POSSIBILITY, reaction => ({
		name: reaction.name
	}))
];

export const bigEventDataMappings: DataMapping[] = [
	defineDataMapping(ReactionCollectorBigEventData, BIG_EVENT_DATA_KINDS.COLLECTOR, data => ({
		eventId: data.eventId
	}))
];
