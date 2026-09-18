import { Item } from "../../../objects/Item";
import {
	ReactionCollectorDataKind, ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		sell: Record<string, never>;
	}

	interface ReactionCollectorReactionPayloads {
		sellItem: {
			item: Item;
			slot: number;
			price: number;
		};
	}
}

export const SELL_DATA_KINDS = { COLLECTOR: "sell" } as const satisfies Record<string, ReactionCollectorDataKind>;

export const SELL_REACTION_KINDS = { ITEM: "sellItem" } as const satisfies Record<string, ReactionCollectorReactionKind>;
