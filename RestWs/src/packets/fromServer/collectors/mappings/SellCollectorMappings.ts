import {
	ReactionCollectorSellData, ReactionCollectorSellItemReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorSell";
import {
	SELL_DATA_KINDS, SELL_REACTION_KINDS
} from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping, defineDataMapping, defineReactionMapping, ReactionMapping
} from "../CollectorMapping";

export const sellDataMappings: DataMapping[] = [defineDataMapping(ReactionCollectorSellData, SELL_DATA_KINDS.COLLECTOR, () => ({}))];

export const sellReactionMappings: ReactionMapping[] = [
	defineReactionMapping(ReactionCollectorSellItemReaction, SELL_REACTION_KINDS.ITEM, reaction => ({
		item: reaction.item,
		slot: reaction.slot,
		price: reaction.price
	}))
];
