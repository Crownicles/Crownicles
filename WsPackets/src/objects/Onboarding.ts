/**
 * The royal contest trials the app draws in the contest booklet: the first campaign missions, in
 * campaign order. A RestWs test keeps them equal to Lib's.
 */
export const ONBOARDING_TRIALS = [
	{
		id: "audience",
		missions: ["commandReport", "commandMission", "earnMoney"]
	},
	{
		id: "road",
		missions: ["findOrBuyItem", "drinkPotion", "visitCityNpc", "commandMap"]
	},
	{
		id: "path",
		missions: ["chooseClass"]
	}
] as const;

export type OnboardingTrial = typeof ONBOARDING_TRIALS[number];
export type OnboardingTrialId = OnboardingTrial["id"];

/** How many letters the king writes during the contest week. */
export const ROYAL_LETTERS = 7;
