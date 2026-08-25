import {
	ReactionCollectorDataKind, ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";
import { PlantId } from "../../../objects/PlantId";
import { PetSex } from "../../../objects/OwnedPet";

export const SMALL_EVENT_FOOD_TYPES = {
	BAD_SMELL: "badSmell",
	VEGETARIAN: "vegetarian",
	MEAT: "meat",
	GOOD_SMELL: "goodSmell",
	SOUP: "soup"
} as const;

export type SmallEventFoodType = typeof SMALL_EVENT_FOOD_TYPES[keyof typeof SMALL_EVENT_FOOD_TYPES];

export const SMALL_EVENT_BAD_PET_ACTION_IDS = {
	INTIMIDATE: "intimidate",
	PLEAD: "plead",
	GIVE_MEAT: "giveMeat",
	GIVE_VEG: "giveVeg",
	FLEE: "flee",
	HIDE: "hide",
	WAIT: "wait",
	PROTECT: "protect",
	DISTRACT: "distract",
	CALM: "calm",
	IMPOSER: "imposer",
	ENERGIZE: "energize"
} as const;

export type SmallEventBadPetActionId = typeof SMALL_EVENT_BAD_PET_ACTION_IDS[keyof typeof SMALL_EVENT_BAD_PET_ACTION_IDS];

export const GARDENER_CONDITION_KEYS = [
	"free",
	"paid",
	"paidAccepted",
	"moon",
	"night",
	"herbivorePet",
	"legendaryHerbivorePet",
	"mage",
	"firePet",
	"fireItem",
	"carnivorePet",
	"needLevel",
	"needGarden",
	"needMoney",
	"needMoonlight",
	"needNight",
	"needHerbivorePet",
	"needLegendaryHerbivorePet",
	"needFireAffinity",
	"needCarnivorePet",
	"seedSlotFull",
	"allSeedsObtained",
	"noPlantSpace",
	"refused",
	"none",
	"tipBuyHome",
	"tipUpgradeForGarden",
	"tipPlantSeed",
	"tipHarvestReady",
	"tipEmptyPlots",
	"tipUpgradeSoil",
	"tipGeneric"
] as const;

export type GardenerConditionKey = typeof GARDENER_CONDITION_KEYS[number];

export const SMALL_EVENT_GOBLET_IDS = {
	METAL: "metal",
	BIGGEST: "biggest",
	SPARKLING: "sparkling",
	CRACKED: "cracked"
} as const;

export type SmallEventGobletId = typeof SMALL_EVENT_GOBLET_IDS[keyof typeof SMALL_EVENT_GOBLET_IDS];

export const SMALL_EVENT_GOBLET_STRATEGIES = {
	CLASSIC: "classic",
	SAFE: "safe",
	RISKY: "risky",
	GAMBLER: "gambler"
} as const;

export type SmallEventGobletStrategy = typeof SMALL_EVENT_GOBLET_STRATEGIES[keyof typeof SMALL_EVENT_GOBLET_STRATEGIES];

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		smallEventAltar: {
			poolAmount: number;
			poolThreshold: number;
		};
		smallEventBadPet: {
			petId: number;
			sex: PetSex;
			petNickname?: string;
		};
		smallEventGardener: {
			seedId: PlantId;
			cost: number;
			conditionKey: GardenerConditionKey;
			isFirstEncounter?: boolean;
		};
		smallEventGobletsGame: Record<string, never>;
		smallEventInteractOtherPlayers: {
			keycloakId: string;
			rank?: number;
		};
		smallEventLimoges: {
			questionId: string;
		};
		smallEventLottery: Record<string, never>;
		smallEventPetFood: {
			foodType: SmallEventFoodType;
			petSex: PetSex;
		};
		smallEventWitch: Record<string, never>;
	}

	interface ReactionCollectorReactionPayloads {
		smallEventAltarContribute: {
			amount: number;
		};
		smallEventBadPet: {
			id: SmallEventBadPetActionId;
		};
		smallEventGobletsGame: {
			id?: SmallEventGobletId;
			strategy?: SmallEventGobletStrategy;
		};
		smallEventLotteryEasy: Record<string, never>;
		smallEventLotteryMedium: Record<string, never>;
		smallEventLotteryHard: Record<string, never>;
		smallEventPetFoodInvestigate: Record<string, never>;
		smallEventPetFoodSendPet: Record<string, never>;
		smallEventPetFoodContinue: Record<string, never>;
		smallEventWitch: {
			id: string;
		};
	}
}

export const SMALL_EVENT_DATA_KINDS = {
	ALTAR: "smallEventAltar",
	BAD_PET: "smallEventBadPet",
	GARDENER: "smallEventGardener",
	GOBLETS_GAME: "smallEventGobletsGame",
	INTERACT_OTHER_PLAYERS: "smallEventInteractOtherPlayers",
	LIMOGES: "smallEventLimoges",
	LOTTERY: "smallEventLottery",
	PET_FOOD: "smallEventPetFood",
	WITCH: "smallEventWitch"
} as const satisfies Record<string, ReactionCollectorDataKind>;

export const SMALL_EVENT_REACTION_KINDS = {
	ALTAR_CONTRIBUTE: "smallEventAltarContribute",
	BAD_PET: "smallEventBadPet",
	GOBLETS_GAME: "smallEventGobletsGame",
	LOTTERY_EASY: "smallEventLotteryEasy",
	LOTTERY_MEDIUM: "smallEventLotteryMedium",
	LOTTERY_HARD: "smallEventLotteryHard",
	PET_FOOD_INVESTIGATE: "smallEventPetFoodInvestigate",
	PET_FOOD_SEND_PET: "smallEventPetFoodSendPet",
	PET_FOOD_CONTINUE: "smallEventPetFoodContinue",
	WITCH: "smallEventWitch"
} as const satisfies Record<string, ReactionCollectorReactionKind>;
