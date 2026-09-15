import {
	ReactionCollectorDataKind, ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";
import { Item } from "../../../objects/Item";
import { ItemWithDetails } from "../../../objects/ItemWithDetails";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		itemChoice: {
			item: Item;
		};
		itemAccept: {
			itemWithDetails: ItemWithDetails;
		};
	}

	interface ReactionCollectorReactionPayloads {
		itemChoiceItem: {
			slot: number;
			itemWithDetails: ItemWithDetails;
		};
		itemChoiceDrinkPotion: Record<string, never>;
		itemChoiceRefuse: Record<string, never>;
		itemAcceptDrinkPotion: Record<string, never>;
	}
}

export const ITEM_DATA_KINDS = {
	CHOICE: "itemChoice",
	ACCEPT: "itemAccept"
} as const satisfies Record<string, ReactionCollectorDataKind>;

export const ITEM_REACTION_KINDS = {
	CHOICE_ITEM: "itemChoiceItem",
	CHOICE_DRINK_POTION: "itemChoiceDrinkPotion",
	CHOICE_REFUSE: "itemChoiceRefuse",
	ACCEPT_DRINK_POTION: "itemAcceptDrinkPotion"
} as const satisfies Record<string, ReactionCollectorReactionKind>;
