import {
	ReactionCollectorDefensePersonalityData, ReactionCollectorDefensePersonalityReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorDefensePersonality";
import { AiPersonalityConstants } from "../../../../../../Lib/src/constants/AiPersonalityConstants";
import {
	DEFENSE_DATA_KINDS, DEFENSE_REACTION_KINDS
} from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping, defineDataMapping, defineReactionMapping, ReactionMapping
} from "../CollectorMapping";

export const defenseDataMappings: DataMapping[] = [
	defineDataMapping(ReactionCollectorDefensePersonalityData, DEFENSE_DATA_KINDS.COLLECTOR, data => ({
		classId: data.classId,
		recentDefenses: data.recentDefenses,

		// Core counts the defenses over this window: the app names it with the list instead of keeping its own copy
		recentDefensesDays: AiPersonalityConstants.RECENT_DEFENSES_DAYS,
		...data.currentPersonality ? { currentPersonality: data.currentPersonality } : {}
	}))
];
export const defenseReactionMappings: ReactionMapping[] = [
	defineReactionMapping(
		ReactionCollectorDefensePersonalityReaction,
		DEFENSE_REACTION_KINDS.STYLE,
		reaction => reaction.personality ? { personality: reaction.personality } : {}
	)
];
