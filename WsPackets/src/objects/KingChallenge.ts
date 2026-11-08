/** What crossing tiers of the king's challenge pays. */
export type KingChallengeReward = {
	money: number;
	tokens: number;
	gems: number;
};

/** The player's progress in the king's challenge of the current week. */
export type KingChallengeProgress = {
	weeklyScore: number;

	/** Number of tiers reached this week, between 0 and the tier count. */
	tier: number;

	/** Weekly score required by each tier, in increasing order; the last one is the champion tier. */
	thresholds: number[];

	/** When the challenge starts over, as an absolute timestamp. */
	nextResetDate: number;
};

/** The rules of the king's challenge that do not change from one week to the next. */
export type KingChallengeRules = {

	/** What each tier pays, in tier order; the last one is the champion tier, outside the ladder. */
	tierRewards: KingChallengeReward[];

	/** The tokens of a tier are only paid to a player holding fewer tokens than this. */
	tokenCap: number;
};
