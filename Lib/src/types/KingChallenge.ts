import { Millisecond } from "./TimeTypes";

/**
 * What a player receives when crossing one or several tiers of the king's challenge
 */
export type KingChallengeReward = {
	money: number;
	tokens: number;
	gems: number;
};

/**
 * Progress of a player in the king's challenge of the current week
 */
export type KingChallengeProgress = {
	weeklyScore: number;

	/** Number of tiers reached this week, between 0 and the tier count */
	tier: number;

	/** Weekly score required by each tier, in increasing order */
	thresholds: number[];

	/** Date at which the challenge resets */
	nextResetDate: Millisecond;
};


/**
 * Weekly scores of the previous weeks the thresholds are computed from
 */
export type KingChallengeReferenceScores = {

	/** Weekly score of the reference rank, for the ladder of tiers */
	ladder: readonly number[];

	/** Weekly score of the best player, for the champion tier */
	champion: readonly number[];
};

/**
 * Weekly scores of the week ending added to the reference history
 */
export type KingChallengeWeekScores = {
	ladder: number;
	champion: number;
};
