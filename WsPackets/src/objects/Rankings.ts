export enum TopDataType {
	SCORE = "Score",
	GLORY = "Glory",
	GUILD = "Guild"
}
export enum TopTiming {
	ALL_TIME = "AllTime",
	WEEK = "Week"
}
export enum EloGameResult {
	LOSS = 0,
	DRAW = 0.5,
	WIN = 1
}
export type FightHistoryEntry = {
	id: number;
	initiator: boolean;
	opponentName?: string;
	result: EloGameResult;
	glory: {
		initial: {
			me: number; opponent: number;
		};
		change: {
			me: number; opponent: number;
		};
		leaguesChanges: {
			me?: {
				oldLeague: number; newLeague: number;
			};
			opponent?: {
				oldLeague: number; newLeague: number;
			};
		};
	};
	classes: {
		me: number; opponent: number;
	};
	date: number;
};
export type RankingEntry = {
	rank: number; sameContext: boolean; name: string; value: number; level: number; leagueId?: number; mapType?: string; effectId?: string; afk?: boolean;
};
export type LeagueInfo = {
	id: number; minGloryPoints: number; maxGloryPoints: number; money: number; xp: number; winMoney: number;
};

/**
 * Why the season reward cannot be claimed yet, so the app can say so before the player asks.
 * `null` means it is claimable right now.
 */
export type LeagueRewardAvailability =
	| {
		type: "notSunday"; nextSunday: number;
	}
	| { type: "noPoints" }
	| { type: "alreadyClaimed" }
	| null;
export type LeagueRewardOutcome =
	| {
		type: "success"; score: number; money: number; xp: number; gloryPoints: number; oldLeagueId: number; rank: number;
	}
	| {
		type: "notSunday"; nextSunday: number;
	}
	| { type: "noPoints" }
	| { type: "alreadyClaimed" };
