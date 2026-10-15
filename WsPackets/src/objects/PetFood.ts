export enum PetFood {
	CANDY = "commonFood",
	SALAD = "herbivorousFood",
	MEAT = "carnivorousFood",
	ULTIMATE = "ultimateFood"
}

export const PET_FEED_RESULTS = {
	HAPPY: "happy",
	VERY_HAPPY: "veryHappy",
	VERY_VERY_HAPPY: "veryVeryHappy",
	DISLIKE: "dislike"
} as const;

export type PetFeedResult = typeof PET_FEED_RESULTS[keyof typeof PET_FEED_RESULTS];

export const PET_FEED_ERRORS = {
	NO_PET: "noPet",
	EXPEDITION: "expedition",
	NOT_HUNGRY: "notHungry",
	NO_MONEY: "noMoney",
	EMPTY_STORAGE: "emptyStorage",
	SITUATION_CHANGED: "situationChanged",
	CANCELLED: "cancelled"
} as const;
