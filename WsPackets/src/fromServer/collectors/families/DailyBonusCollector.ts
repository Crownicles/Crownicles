import { ItemWithDetails } from "../../../objects/ItemWithDetails";
import {
	ReactionCollectorDataKind, ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		dailyBonus: Record<string, never>;
	}

	interface ReactionCollectorReactionPayloads {
		dailyBonusObject: {
			object: ItemWithDetails;
		};
	}
}

export const DAILY_BONUS_DATA_KINDS = { COLLECTOR: "dailyBonus" } as const satisfies Record<string, ReactionCollectorDataKind>;

export const DAILY_BONUS_REACTION_KINDS = { OBJECT: "dailyBonusObject" } as const satisfies Record<string, ReactionCollectorReactionKind>;
