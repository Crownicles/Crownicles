import { DefenseRecord } from "../../../objects/DefenseRecord";
import {
	ReactionCollectorDataKind, ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		defense: {
			classId: number;

			/** Missing when a different style is picked at random at each fight. */
			currentPersonality?: string;

			/** The most frequent attackers first. */
			recentDefenses: DefenseRecord[];

			/** How many days back `recentDefenses` goes. */
			recentDefensesDays: number;
		};
	}

	interface ReactionCollectorReactionPayloads {

		/** A missing personality picks a different style at random at each fight. */
		defenseStyle: {
			personality?: string;
		};
	}
}

export const DEFENSE_DATA_KINDS = { COLLECTOR: "defense" } as const satisfies Record<string, ReactionCollectorDataKind>;
export const DEFENSE_REACTION_KINDS = { STYLE: "defenseStyle" } as const satisfies Record<string, ReactionCollectorReactionKind>;
