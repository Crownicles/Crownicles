export const ONBOARDING_TRIAL_IDS = {
	AUDIENCE: "audience",
	ROAD: "road",
	PATH: "path"
} as const;

export const ONBOARDING_MISSION_IDS = {
	COMMAND_REPORT: "commandReport",
	COMMAND_MISSION: "commandMission",
	EARN_MONEY: "earnMoney",
	FIND_OR_BUY_ITEM: "findOrBuyItem",
	DRINK_POTION: "drinkPotion",
	COMMAND_MAP: "commandMap",
	VISIT_CITY_NPC: "visitCityNpc",
	CHOOSE_CLASS: "chooseClass"
} as const;

/**
 * The royal contest trials the app draws in the contest booklet: the first campaign missions, in
 * campaign order. A RestWs test keeps them equal to Lib's.
 */
export const ONBOARDING_TRIALS = [
	{
		id: ONBOARDING_TRIAL_IDS.AUDIENCE,
		missions: [
			ONBOARDING_MISSION_IDS.COMMAND_REPORT,
			ONBOARDING_MISSION_IDS.COMMAND_MISSION,
			ONBOARDING_MISSION_IDS.EARN_MONEY
		]
	},
	{
		id: ONBOARDING_TRIAL_IDS.ROAD,
		missions: [
			ONBOARDING_MISSION_IDS.FIND_OR_BUY_ITEM,
			ONBOARDING_MISSION_IDS.DRINK_POTION,
			ONBOARDING_MISSION_IDS.COMMAND_MAP,
			ONBOARDING_MISSION_IDS.VISIT_CITY_NPC
		]
	},
	{
		id: ONBOARDING_TRIAL_IDS.PATH,
		missions: [ONBOARDING_MISSION_IDS.CHOOSE_CLASS]
	}
] as const;

export type OnboardingTrial = typeof ONBOARDING_TRIALS[number];
export type OnboardingTrialId = OnboardingTrial["id"];
export type OnboardingMissionId = OnboardingTrial["missions"][number];

/** How many letters the king writes during the contest week. */
export const ROYAL_LETTERS = 7;
