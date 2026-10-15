import {
	ExpeditionClientData, ExpeditionInProgressData
} from "../../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import { ExpeditionOptionData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorPetExpeditionChoice";
import {
	getDifficultyCategoryName, getRewardCategoryName, getRiskCategoryName
} from "../../../../../Lib/src/utils/ExpeditionUtils";
import {
	ExpeditionError, EXPEDITION_ERRORS, ExpeditionLocation, ExpeditionOption, ExpeditionProgress
} from "../../../../../WsPackets/src/objects/PetExpedition";

export function expeditionLocation(data: Pick<ExpeditionClientData, "locationType" | "mapLocationId" | "isDistantExpedition">): ExpeditionLocation {
	return {
		locationType: data.locationType,
		...data.mapLocationId === undefined ? {} : { mapLocationId: data.mapLocationId },
		...data.isDistantExpedition === undefined ? {} : { isDistantExpedition: data.isDistantExpedition }
	};
}

export function expeditionOption(data: ExpeditionOptionData): ExpeditionOption {
	return {
		...expeditionLocation(data),
		id: data.id,
		displayDurationMinutes: data.displayDurationMinutes,
		riskCategory: getRiskCategoryName(data.riskRate),
		difficultyCategory: getDifficultyCategoryName(data.difficulty),
		rewardCategory: getRewardCategoryName(data.rewardIndex),
		foodCost: data.foodCost,
		...data.hasCloneTalismanBonus === undefined ? {} : { hasCloneTalismanBonus: data.hasCloneTalismanBonus },
		...data.hasBonusTokens === undefined ? {} : { hasBonusTokens: data.hasBonusTokens }
	};
}

export function expeditionProgress(data: ExpeditionInProgressData): ExpeditionProgress {
	return {
		...expeditionLocation(data),
		pet: data.pet,
		riskCategory: getRiskCategoryName(data.riskRate),
		returnTime: data.endTime,
		startTime: data.startTime,
		durationMinutes: data.durationMinutes,
		...data.foodConsumed === undefined ? {} : { foodConsumed: data.foodConsumed },
		...data.foodConsumedDetails ? { foodConsumedDetails: data.foodConsumedDetails } : {}
	};
}

export function expeditionError(code?: string): ExpeditionError {
	return Object.values(EXPEDITION_ERRORS).find(candidate => candidate === code) ?? EXPEDITION_ERRORS.INVALID_STATE;
}
