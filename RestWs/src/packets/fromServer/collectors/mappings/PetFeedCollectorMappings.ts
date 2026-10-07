import {
	ReactionCollectorPetFeedWithGuildData, ReactionCollectorPetFeedWithGuildFoodReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPetFeedWithGuild";
import { ReactionCollectorPetFeedWithoutGuildData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPetFeedWithoutGuild";
import {
	PET_FEED_DATA_KINDS, PET_FEED_REACTION_KINDS
} from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping, defineDataMapping, defineReactionMapping, ReactionMapping
} from "../CollectorMapping";

export const petFeedDataMappings: DataMapping[] = [
	defineDataMapping(ReactionCollectorPetFeedWithGuildData, PET_FEED_DATA_KINDS.GUILD, data => ({ pet: data.pet })),
	defineDataMapping(ReactionCollectorPetFeedWithoutGuildData, PET_FEED_DATA_KINDS.PERSONAL, data => ({
		pet: data.pet, food: data.food, price: data.price
	}))
];
export const petFeedReactionMappings: ReactionMapping[] = [
	defineReactionMapping(ReactionCollectorPetFeedWithGuildFoodReaction, PET_FEED_REACTION_KINDS.FOOD, reaction => ({
		food: reaction.food, amount: reaction.amount, maxAmount: reaction.maxAmount
	}))
];
