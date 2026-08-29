import {
	ReactionCollectorDataKind, ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		reportDestination: Record<string, never>;
	}

	interface ReactionCollectorReactionPayloads {
		reportDestination: {
			mapId: number;
			mapTypeId: string;
			tripDuration?: number;
		};
		reportStayInCity: Record<string, never>;
	}
}

/** Collectors that move the player through the report's adventure flow. */
export const REPORT_COLLECTOR_DATA_KINDS = {
	DESTINATION: "reportDestination"
} as const satisfies Record<string, ReactionCollectorDataKind>;

export const REPORT_COLLECTOR_REACTION_KINDS = {
	DESTINATION: "reportDestination",
	STAY_IN_CITY: "reportStayInCity"
} as const satisfies Record<string, ReactionCollectorReactionKind>;
