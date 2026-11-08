/**
 * Best king guard beaten by a player, and its position among all the players who beat one
 */
export type KingGuardPersonalRecord = {
	level: number;

	// Number of times the player beat a stronger guard than all the ones it beat before, the first victory included
	recordsBroken: number;

	// Position among the players who beat a king guard, ties broken by who reached the level first
	rank: number;
	challengers: number;
};

/**
 * Strongest king guard beaten by a player
 */
export type KingGuardChallengerRecord = {
	keycloakId: string;
	level: number;
};

/**
 * Summary of all the fights of a player against the king guards
 */
export type KingGuardFightStats = {
	won: number;
	lost: number;
	draw: number;

	// Current level of the player, to tell how far above it its record is
	playerLevel: number;

	// Absent until the player beats a king guard
	record?: KingGuardPersonalRecord;

	// Players who beat the strongest king guards, the kingdom record first (see FightConstants.KING_GUARD.LEADERBOARD_SIZE)
	leaderboard: KingGuardChallengerRecord[];
};
