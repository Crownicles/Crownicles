export const LEAGUE_REWARD_BLOCKERS = {
	NOT_SUNDAY: "notSunday",
	NO_POINTS: "noPoints",
	ALREADY_CLAIMED: "alreadyClaimed"
} as const;

export type LeagueRewardBlocker = typeof LEAGUE_REWARD_BLOCKERS[keyof typeof LEAGUE_REWARD_BLOCKERS];

/**
 * Why the season reward cannot be claimed, so a frontend can say so before the player asks for it.
 * `null` means the reward is claimable right now.
 */
export type LeagueRewardAvailability =
	| {
		type: typeof LEAGUE_REWARD_BLOCKERS.NOT_SUNDAY; nextSunday: number;
	}
	| {
		type: typeof LEAGUE_REWARD_BLOCKERS.NO_POINTS;
	}
	| {
		type: typeof LEAGUE_REWARD_BLOCKERS.ALREADY_CLAIMED;
	}
	| null;
