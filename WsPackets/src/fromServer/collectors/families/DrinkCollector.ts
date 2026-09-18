import {
	ReactionCollectorDataKind, ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";
import { SupportItem } from "../../../objects/SupportItem";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		drink: Record<string, never>;
	}

	interface ReactionCollectorReactionPayloads {
		drinkPotion: {
			potion: SupportItem;
		};
	}
}

export const DRINK_DATA_KINDS = { COLLECTOR: "drink" } as const satisfies Record<string, ReactionCollectorDataKind>;

export const DRINK_REACTION_KINDS = { POTION: "drinkPotion" } as const satisfies Record<string, ReactionCollectorReactionKind>;
