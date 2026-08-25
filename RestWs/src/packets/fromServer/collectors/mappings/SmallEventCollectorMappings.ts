import {
	ReactionCollectorAltarContributeReaction, ReactionCollectorAltarData
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorAltar";
import {
	ReactionCollectorBadPetReaction, ReactionCollectorBadPetSmallEventData
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorBadPetSmallEvent";
import { ReactionCollectorGardenerData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorGardener";
import {
	ReactionCollectorGobletsGameBiggestReaction,
	ReactionCollectorGobletsGameCrackedReaction,
	ReactionCollectorGobletsGameData,
	ReactionCollectorGobletsGameMetalReaction,
	ReactionCollectorGobletsGameSparklingReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorGobletsGame";
import { ReactionCollectorInteractOtherPlayersPoorData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorInteractOtherPlayers";
import { ReactionCollectorLimogesData } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorLimoges";
import {
	ReactionCollectorLotteryData,
	ReactionCollectorLotteryEasyReaction,
	ReactionCollectorLotteryHardReaction,
	ReactionCollectorLotteryMediumReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorLottery";
import {
	ReactionCollectorPetFoodContinueReaction,
	ReactionCollectorPetFoodInvestigateReaction,
	ReactionCollectorPetFoodSendPetReaction,
	ReactionCollectorPetFoodSmallEventData
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorPetFoodSmallEvent";
import {
	ReactionCollectorWitchData, ReactionCollectorWitchReaction
} from "../../../../../../Lib/src/packets/interaction/ReactionCollectorWitch";
import {
	SMALL_EVENT_DATA_KINDS, SMALL_EVENT_FOOD_TYPES, SMALL_EVENT_GOBLET_IDS,
	SMALL_EVENT_GOBLET_STRATEGIES, SMALL_EVENT_BAD_PET_ACTION_IDS,
	SMALL_EVENT_REACTION_KINDS,
	SmallEventBadPetActionId,
	SmallEventGobletId, SmallEventGobletStrategy
} from "../../../../../../WsPackets/src/fromServer/collectors";
import { PetSex } from "../../../../../../WsPackets/src/objects/OwnedPet";
import {
	DataMapping, defineDataMapping, defineReactionMapping, ReactionMapping
} from "../CollectorMapping";

function toPetSex(sex: string): PetSex | null {
	return sex === "m" || sex === "f" ? sex : null;
}

function isBadPetActionId(id: string): id is SmallEventBadPetActionId {
	return Object.values(SMALL_EVENT_BAD_PET_ACTION_IDS).includes(id as SmallEventBadPetActionId);
}

function isFoodType(foodType: string): foodType is typeof SMALL_EVENT_FOOD_TYPES[keyof typeof SMALL_EVENT_FOOD_TYPES] {
	return Object.values(SMALL_EVENT_FOOD_TYPES).includes(foodType as typeof SMALL_EVENT_FOOD_TYPES[keyof typeof SMALL_EVENT_FOOD_TYPES]);
}

function isGobletId(id: string | undefined): id is typeof SMALL_EVENT_GOBLET_IDS[keyof typeof SMALL_EVENT_GOBLET_IDS] {
	return id !== undefined && Object.values(SMALL_EVENT_GOBLET_IDS).includes(id as typeof SMALL_EVENT_GOBLET_IDS[keyof typeof SMALL_EVENT_GOBLET_IDS]);
}

function isGobletStrategy(strategy: string | undefined): strategy is typeof SMALL_EVENT_GOBLET_STRATEGIES[keyof typeof SMALL_EVENT_GOBLET_STRATEGIES] {
	return strategy !== undefined && Object.values(SMALL_EVENT_GOBLET_STRATEGIES).includes(strategy as typeof SMALL_EVENT_GOBLET_STRATEGIES[keyof typeof SMALL_EVENT_GOBLET_STRATEGIES]);
}

function mapGobletReaction(reaction: {
	id?: string; strategy?: string;
}): {
	id: SmallEventGobletId;
	strategy: SmallEventGobletStrategy;
} | null {
	if (!isGobletId(reaction.id) || !isGobletStrategy(reaction.strategy)) {
		return null;
	}
	return {
		id: reaction.id,
		strategy: reaction.strategy
	};
}

export const smallEventReactionMappings: ReactionMapping[] = [
	defineReactionMapping(ReactionCollectorAltarContributeReaction, SMALL_EVENT_REACTION_KINDS.ALTAR_CONTRIBUTE, reaction => ({
		amount: reaction.amount
	})),
	defineReactionMapping(ReactionCollectorBadPetReaction, SMALL_EVENT_REACTION_KINDS.BAD_PET, reaction =>
		isBadPetActionId(reaction.id) ? { id: reaction.id } : null),
	defineReactionMapping(ReactionCollectorGobletsGameMetalReaction, SMALL_EVENT_REACTION_KINDS.GOBLETS_GAME, reaction => mapGobletReaction(reaction)),
	defineReactionMapping(ReactionCollectorGobletsGameBiggestReaction, SMALL_EVENT_REACTION_KINDS.GOBLETS_GAME, reaction => mapGobletReaction(reaction)),
	defineReactionMapping(ReactionCollectorGobletsGameSparklingReaction, SMALL_EVENT_REACTION_KINDS.GOBLETS_GAME, reaction => mapGobletReaction(reaction)),
	defineReactionMapping(ReactionCollectorGobletsGameCrackedReaction, SMALL_EVENT_REACTION_KINDS.GOBLETS_GAME, reaction => mapGobletReaction(reaction)),
	defineReactionMapping(ReactionCollectorLotteryEasyReaction, SMALL_EVENT_REACTION_KINDS.LOTTERY_EASY, () => ({})),
	defineReactionMapping(ReactionCollectorLotteryMediumReaction, SMALL_EVENT_REACTION_KINDS.LOTTERY_MEDIUM, () => ({})),
	defineReactionMapping(ReactionCollectorLotteryHardReaction, SMALL_EVENT_REACTION_KINDS.LOTTERY_HARD, () => ({})),
	defineReactionMapping(ReactionCollectorPetFoodInvestigateReaction, SMALL_EVENT_REACTION_KINDS.PET_FOOD_INVESTIGATE, () => ({})),
	defineReactionMapping(ReactionCollectorPetFoodSendPetReaction, SMALL_EVENT_REACTION_KINDS.PET_FOOD_SEND_PET, () => ({})),
	defineReactionMapping(ReactionCollectorPetFoodContinueReaction, SMALL_EVENT_REACTION_KINDS.PET_FOOD_CONTINUE, () => ({})),
	defineReactionMapping(ReactionCollectorWitchReaction, SMALL_EVENT_REACTION_KINDS.WITCH, reaction => ({
		id: reaction.id
	}))
];

export const smallEventDataMappings: DataMapping[] = [
	defineDataMapping(ReactionCollectorAltarData, SMALL_EVENT_DATA_KINDS.ALTAR, data => ({
		poolAmount: data.poolAmount,
		poolThreshold: data.poolThreshold
	})),
	defineDataMapping(ReactionCollectorBadPetSmallEventData, SMALL_EVENT_DATA_KINDS.BAD_PET, data => {
		const sex = toPetSex(data.sex);
		if (sex === null) {
			return null;
		}
		return {
			petId: data.petId,
			sex,
			...data.petNickname === undefined ? {} : { petNickname: data.petNickname }
		};
	}),
	defineDataMapping(ReactionCollectorGardenerData, SMALL_EVENT_DATA_KINDS.GARDENER, data => ({
		seedId: data.seedId,
		cost: data.cost,
		conditionKey: data.conditionKey,
		...data.isFirstEncounter === undefined ? {} : { isFirstEncounter: data.isFirstEncounter }
	})),
	defineDataMapping(ReactionCollectorGobletsGameData, SMALL_EVENT_DATA_KINDS.GOBLETS_GAME, () => ({})),
	defineDataMapping(ReactionCollectorInteractOtherPlayersPoorData, SMALL_EVENT_DATA_KINDS.INTERACT_OTHER_PLAYERS, data => ({
		keycloakId: data.keycloakId,
		...data.rank === undefined ? {} : { rank: data.rank }
	})),
	defineDataMapping(ReactionCollectorLimogesData, SMALL_EVENT_DATA_KINDS.LIMOGES, data => ({
		questionId: data.questionId
	})),
	defineDataMapping(ReactionCollectorLotteryData, SMALL_EVENT_DATA_KINDS.LOTTERY, () => ({})),
	defineDataMapping(ReactionCollectorPetFoodSmallEventData, SMALL_EVENT_DATA_KINDS.PET_FOOD, data => {
		if (!isFoodType(data.foodType)) {
			return null;
		}
		return {
			foodType: data.foodType,
			petSex: data.petSex
		};
	}),
	defineDataMapping(ReactionCollectorWitchData, SMALL_EVENT_DATA_KINDS.WITCH, () => ({}))
];
