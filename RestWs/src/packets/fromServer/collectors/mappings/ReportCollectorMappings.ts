import {
	ReactionCollectorChooseDestinationData,
	ReactionCollectorChooseDestinationReaction,
	ReactionCollectorStayInCityReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorChooseDestination";
import {
	REPORT_COLLECTOR_DATA_KINDS, REPORT_COLLECTOR_REACTION_KINDS
} from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping, defineDataMapping, defineReactionMapping, ReactionMapping
} from "../CollectorMapping";

export const reportCollectorReactionMappings: ReactionMapping[] = [
	defineReactionMapping(ReactionCollectorChooseDestinationReaction, REPORT_COLLECTOR_REACTION_KINDS.DESTINATION, reaction => ({
		mapId: reaction.mapId,
		mapTypeId: reaction.mapTypeId,
		...reaction.tripDuration === undefined ? {} : { tripDuration: reaction.tripDuration }
	})),
	defineReactionMapping(ReactionCollectorStayInCityReaction, REPORT_COLLECTOR_REACTION_KINDS.STAY_IN_CITY, () => ({}))
];

export const reportCollectorDataMappings: DataMapping[] = [
	defineDataMapping(
		ReactionCollectorChooseDestinationData, REPORT_COLLECTOR_DATA_KINDS.DESTINATION, () => ({})
	)
];
