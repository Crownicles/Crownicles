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
export const FIGHT_HISTORY_ENTRY_TYPES = {
	PLAYER: "player",
	KING_GUARD: "kingGuard"
} as const;

type FightHistoryEntryBase = {

	/** Unique within an entry type only: both kinds of fight are logged apart. */
	id: number;
	result: EloGameResult;
	classes: {
		me: number; opponent: number;
	};
	date: number;
};

export type PlayerFightHistoryEntry = FightHistoryEntryBase & {
	type: typeof FIGHT_HISTORY_ENTRY_TYPES.PLAYER;
	initiator: boolean;
	opponentName?: string;

	/** Opens the opponent's profile, as a ranking entry's `playerRef` does. */
	opponentRef: string;
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
};

/** A fight against a king guard, when the arena found no opponent: no glory was at stake. */
export type KingGuardFightHistoryEntry = FightHistoryEntryBase & {
	type: typeof FIGHT_HISTORY_ENTRY_TYPES.KING_GUARD;
	kingGuard: { level: number };
};

export type FightHistoryEntry = PlayerFightHistoryEntry | KingGuardFightHistoryEntry;

/** Best king guard beaten by the player, and its position among all the players who beat one. */
export type KingGuardPersonalRecord = {
	level: number;

	/** Times the player beat a stronger guard than all the ones it beat before, the first victory included. */
	recordsBroken: number;

	/** Ties are broken by who reached the level first. */
	rank: number;
	challengers: number;
};

/** A player of the king guards' roll of honour; its rank is its position in the list. */
export type KingGuardChallenger = {
	name?: string;

	/** Opens the player's profile, as a ranking entry's `playerRef` does. */
	playerRef: string;
	level: number;

	/** The player reading the roll. */
	sameContext: boolean;
};

/** Summary of all the fights of the player against the king guards. */
export type KingGuardFightStats = {
	won: number;
	lost: number;
	draw: number;

	/** Tells how far above the player's level its record is. */
	playerLevel: number;

	/** Absent until the player beats a king guard. */
	record?: KingGuardPersonalRecord;

	/** The players who beat the strongest king guards, the kingdom record first. */
	leaderboard: KingGuardChallenger[];
};
export type RankingEntry = {
	rank: number;
	sameContext: boolean;
	name: string;
	value: number;
	level: number;
	leagueId?: number;
	mapType?: string;
	effectId?: string;
	afk?: boolean;

	/** Present on player boards, to ask for that player's profile: an opaque handle, never their account. */
	playerRef?: string;
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
