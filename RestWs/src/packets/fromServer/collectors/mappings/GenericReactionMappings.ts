import {
	ReactionCollectorAcceptReaction,
	ReactionCollectorRefuseReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { GENERIC_REACTION_KINDS } from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	defineReactionMapping, ReactionMapping
} from "../CollectorMapping";

export const genericReactionMappings: ReactionMapping[] = [
	defineReactionMapping(ReactionCollectorAcceptReaction, GENERIC_REACTION_KINDS.ACCEPT, () => ({})),
	defineReactionMapping(ReactionCollectorRefuseReaction, GENERIC_REACTION_KINDS.REFUSE, () => ({}))
];
