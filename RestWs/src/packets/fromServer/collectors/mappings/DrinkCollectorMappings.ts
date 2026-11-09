import {
	ReactionCollectorDrinkData,
	ReactionCollectorDrinkReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorDrink";
import {
	DRINK_DATA_KINDS, DRINK_REACTION_KINDS
} from "../../../../../../WsPackets/src/fromServer/collectors";
import { SupportItem } from "../../../../../../WsPackets/src/objects/SupportItem";
import { ItemWithDetails } from "../../../../../../Lib/src/types/ItemWithDetails";
import {
	DataMapping, defineDataMapping, defineReactionMapping, ReactionMapping
} from "../CollectorMapping";

/**
 * A drink collector only ever offers potions, but the back-end field is typed as any item.
 * Narrowing here keeps the protocol honest about what the client receives.
 * @param item
 */
function asPotion(item: ItemWithDetails): SupportItem | null {
	return "nature" in item ? item : null;
}

export const drinkReactionMappings: ReactionMapping[] = [
	defineReactionMapping(ReactionCollectorDrinkReaction, DRINK_REACTION_KINDS.POTION, reaction => {
		const potion = asPotion(reaction.potion);
		return potion === null ? null : { potion };
	})
];

export const drinkDataMappings: DataMapping[] = [defineDataMapping(ReactionCollectorDrinkData, DRINK_DATA_KINDS.COLLECTOR, () => ({}))];
