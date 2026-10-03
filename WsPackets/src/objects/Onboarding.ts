export const ONBOARDING_TRIAL_IDS = {
	AUDIENCE: "audience",
	ROAD: "road",
	PATH: "path"
} as const;

export const ONBOARDING_MISSION_IDS = {
	COMMAND_REPORT: "commandReport",
	SPEND_TOKENS: "spendTokens",
	COMMAND_MISSION: "commandMission",
	EARN_MONEY: "earnMoney",
	FIND_OR_BUY_ITEM: "findOrBuyItem",
	DRINK_POTION: "drinkPotion",
	COMMAND_MAP: "commandMap",
	VISIT_CITY_NPC: "visitCityNpc",
	CHOOSE_CLASS: "chooseClass"
} as const;

export type OnboardingTrialId = typeof ONBOARDING_TRIAL_IDS[keyof typeof ONBOARDING_TRIAL_IDS];
export type OnboardingMissionId = typeof ONBOARDING_MISSION_IDS[keyof typeof ONBOARDING_MISSION_IDS];

/** A royal contest trial: some of the first campaign missions, in campaign order. */
export type OnboardingTrial = {
	id: OnboardingTrialId;
	missions: OnboardingMissionId[];
};
