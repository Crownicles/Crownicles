/**
 * The royal contest that walks a newcomer through their first hours. Its trials are the first
 * campaign missions, in campaign order; a Core test keeps both lists equal.
 */
export const ONBOARDING_TRIALS = [
	{
		id: "audience",
		missions: [
			"commandMission",
			"spendTokens",
			"earnMoney"
		]
	},
	{
		id: "road",
		missions: [
			"findOrBuyItem",
			"drinkPotion",
			"commandMap",
			"visitCityNpc"
		]
	},
	{
		id: "path",
		missions: ["chooseClass"]
	}
] as const;

export type OnboardingTrial = typeof ONBOARDING_TRIALS[number];
export type OnboardingTrialId = OnboardingTrial["id"];
export type OnboardingMissionId = OnboardingTrial["missions"][number];

/**
 * Hours each royal letter waits after the previous one (the first after the report that starts the count):
 * close together while the newcomer is discovering the game, then about once a day.
 */
const ROYAL_LETTER_DELAYS_HOURS = [
	1,
	3,
	8,
	20,
	20,
	20,
	20
] as const;

export abstract class OnboardingConstants {
	/** Campaign positions 1 to this one form the contest; a newcomer is onboarding while one of them is current. */
	static readonly CAMPAIGN_LENGTH = ONBOARDING_TRIALS.reduce((length, trial) => length + trial.missions.length, 0);

	/** The stop that teaches a mission: while it is the current one, the next stop of the trip is this small event, once. */
	static readonly TEACHING_SMALL_EVENTS: Partial<Record<OnboardingMissionId, string>> = {
		findOrBuyItem: "findItem",
		drinkPotion: "findPotion"
	};

	/** Experience a single report may give while the player travels inside the king's castle, before the road to a first city. */
	static readonly KING_CASTLE_MAX_REPORT_EXPERIENCE = 15;

	/** Small events kept off the road of a newcomer: empty stops, severe setbacks, and later mechanics. */
	static readonly HIDDEN_SMALL_EVENTS: readonly string[] = [
		"doNothing",
		"bigBad",
		"findPet",
		"expeditionAdvice",
		"ultimateFoodMerchant",
		"altar",
		"dwarfPetFan"
	];

	/** The king writes to the newcomer during their first week, often at first and then about daily, spreading the starting purse over it. */
	static readonly ROYAL_MAIL = {
		LETTERS: ROYAL_LETTER_DELAYS_HOURS.length,
		DELAYS_HOURS: ROYAL_LETTER_DELAYS_HOURS,
		TOKENS: 20,
		MONEY: 2000,

		/** The last letter closes the contest week with a few gems on top. */
		FINAL_GEMS: 5
	} as const;
}
