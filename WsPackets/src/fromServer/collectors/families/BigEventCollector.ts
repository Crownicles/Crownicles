import {
	ReactionCollectorDataKind, ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		bigEvent: {
			eventId: number;
		};
	}

	interface ReactionCollectorReactionPayloads {
		bigEventPossibility: {
			name: string;
		};
	}
}

export const BIG_EVENT_DATA_KINDS = {
	COLLECTOR: "bigEvent"
} as const satisfies Record<string, ReactionCollectorDataKind>;

export const BIG_EVENT_REACTION_KINDS = {
	POSSIBILITY: "bigEventPossibility"
} as const satisfies Record<string, ReactionCollectorReactionKind>;
