import {
	ReactionCollectorPetExpeditionChoiceData, ReactionCollectorPetExpeditionSelectReaction, ReactionCollectorPetExpeditionCancelReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPetExpeditionChoice";
import {
	ReactionCollectorPetExpeditionData, ReactionCollectorPetExpeditionRecallReaction, ReactionCollectorPetExpeditionCloseReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPetExpedition";
import {
	ReactionCollectorPetExpeditionFinishedData, ReactionCollectorPetExpeditionClaimReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPetExpeditionFinished";
import { getRiskCategoryName } from "../../../../../../Lib/src/utils/ExpeditionUtils";
import {
	EXPEDITION_DATA_KINDS, EXPEDITION_REACTION_KINDS
} from "../../../../../../WsPackets/src/fromServer/collectors";
import {
	DataMapping, defineDataMapping, defineReactionMapping, ReactionMapping
} from "../CollectorMapping";
import {
	expeditionLocation, expeditionOption
} from "../ExpeditionDataMapper";

export const expeditionDataMappings: DataMapping[] = [
	defineDataMapping(ReactionCollectorPetExpeditionChoiceData, EXPEDITION_DATA_KINDS.CHOICE, data => ({
		pet: data.pet, expeditions: data.expeditions.map(expeditionOption), hasGuild: data.hasGuild, ...data.guildFoodAmount === undefined ? {} : { guildFoodAmount: data.guildFoodAmount }
	})),
	defineDataMapping(ReactionCollectorPetExpeditionData, EXPEDITION_DATA_KINDS.PROGRESS, data => ({
		...expeditionLocation(data),
		pet: data.pet,
		riskCategory: getRiskCategoryName(data.riskRate),
		returnTime: data.returnTime,
		...data.foodConsumed === undefined ? {} : { foodConsumed: data.foodConsumed },
		...data.foodConsumedDetails ? { foodConsumedDetails: data.foodConsumedDetails } : {}
	})),
	defineDataMapping(ReactionCollectorPetExpeditionFinishedData, EXPEDITION_DATA_KINDS.FINISHED, data => ({
		...expeditionLocation(data), pet: data.pet, riskCategory: getRiskCategoryName(data.riskRate), ...data.foodConsumed === undefined ? {} : { foodConsumed: data.foodConsumed }
	}))
];
export const expeditionReactionMappings: ReactionMapping[] = [
	defineReactionMapping(ReactionCollectorPetExpeditionSelectReaction, EXPEDITION_REACTION_KINDS.SELECT, reaction => ({ expeditionId: reaction.expedition.id })),
	defineReactionMapping(ReactionCollectorPetExpeditionCancelReaction, EXPEDITION_REACTION_KINDS.CANCEL, () => ({})),
	defineReactionMapping(ReactionCollectorPetExpeditionRecallReaction, EXPEDITION_REACTION_KINDS.RECALL, () => ({})),
	defineReactionMapping(ReactionCollectorPetExpeditionCloseReaction, EXPEDITION_REACTION_KINDS.CLOSE, () => ({})),
	defineReactionMapping(ReactionCollectorPetExpeditionClaimReaction, EXPEDITION_REACTION_KINDS.CLAIM, () => ({}))
];
