import {
	ReactionCollectorItemAcceptData,
	ReactionCollectorItemAcceptDrinkPotionReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorItemAccept";
import {
	ReactionCollectorItemChoiceData,
	ReactionCollectorItemChoiceDrinkPotionReaction,
	ReactionCollectorItemChoiceItemReaction,
	ReactionCollectorItemChoiceRefuseReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorItemChoice";
import {
	ITEM_DATA_KINDS, ITEM_REACTION_KINDS
} from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping, defineDataMapping, defineReactionMapping, ReactionMapping
} from "../CollectorMapping";

export const itemReactionMappings: ReactionMapping[] = [
	defineReactionMapping(ReactionCollectorItemChoiceItemReaction, ITEM_REACTION_KINDS.CHOICE_ITEM, reaction => ({
		slot: reaction.slot,
		itemWithDetails: reaction.itemWithDetails
	})),
	defineReactionMapping(ReactionCollectorItemChoiceDrinkPotionReaction, ITEM_REACTION_KINDS.CHOICE_DRINK_POTION, () => ({})),
	defineReactionMapping(ReactionCollectorItemChoiceRefuseReaction, ITEM_REACTION_KINDS.CHOICE_REFUSE, () => ({})),
	defineReactionMapping(ReactionCollectorItemAcceptDrinkPotionReaction, ITEM_REACTION_KINDS.ACCEPT_DRINK_POTION, () => ({}))
];

export const itemDataMappings: DataMapping[] = [
	defineDataMapping(ReactionCollectorItemChoiceData, ITEM_DATA_KINDS.CHOICE, data => ({
		item: {
			id: data.item.id,
			category: data.item.category
		}
	})),
	defineDataMapping(ReactionCollectorItemAcceptData, ITEM_DATA_KINDS.ACCEPT, data => ({
		itemWithDetails: data.itemWithDetails
	}))
];
