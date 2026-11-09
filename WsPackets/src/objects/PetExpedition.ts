import { PetSex } from "./OwnedPet";
import { ExpeditionLocationType } from "../fromServer/pet/PetRes";
import { MaterialQuantity } from "./MaterialQuantity";

export type PetBasicInfo = {
	petTypeId: number; petSex: PetSex; petNickname?: string;
};
export type ExpeditionLocation = {
	mapLocationId?: number; locationType: ExpeditionLocationType; isDistantExpedition?: boolean;
};
export type ExpeditionFood = {
	foodType: string; amount: number;
};
export type ExpeditionOption = ExpeditionLocation & {
	id: string;
	displayDurationMinutes: number;
	riskCategory: string;
	difficultyCategory: string;
	rewardCategory: string;
	foodCost: number;
	hasCloneTalismanBonus?: boolean;
	hasBonusTokens?: boolean;
};
export type ExpeditionProgress = ExpeditionLocation & {
	pet: PetBasicInfo;
	riskCategory: string;
	returnTime: number;
	startTime?: number;
	durationMinutes?: number;
	foodConsumed?: number;
	foodConsumedDetails?: ExpeditionFood[];
};
export type ExpeditionRewards = {
	money: number;
	experience: number;
	points: number;
	tokens?: number;
	cloneTalismanFound?: boolean;
	itemGiven?: boolean;
	materialLoot?: MaterialQuantity[];
};
export const EXPEDITION_ERRORS = {
	NO_PET: "noPet",
	NO_EXPEDITION: "noExpedition",
	EXPEDITION_NOT_COMPLETE: "expeditionNotComplete",
	INVALID_STATE: "invalidState",
	EXPEDITION_IN_PROGRESS: "expeditionInProgress",
	NO_TALISMAN: "noTalisman",
	INSUFFICIENT_LOVE: "insufficientLove",
	PET_HUNGRY: "petHungry",
	NOT_ON_CONTINENT: "notOnContinent",
	CANNOT_RECALL_ON_ISLAND: "cannotRecallOnIsland"
} as const;
export type ExpeditionError = typeof EXPEDITION_ERRORS[keyof typeof EXPEDITION_ERRORS];
export const EXPEDITION_FOOD_CAUSES = {
	NO_GUILD: "noGuild", GUILD_NO_FOOD: "guildNoFood"
} as const;
export type ExpeditionFoodCause = typeof EXPEDITION_FOOD_CAUSES[keyof typeof EXPEDITION_FOOD_CAUSES];
