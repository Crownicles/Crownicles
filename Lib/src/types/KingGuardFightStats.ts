/**
 * Guard of the library as shown to the players: the fronts name it from its id, its rating is never sent
 */
export type KingGuardDisplay = {
	id: number;
	level: number;
	classId: number;
};

/**
 * Best king guard beaten by a player, and its position among all the players who beat one.
 * The best guard is the one with the highest rating today among the guards the player beat: it may change without the player fighting
 */
export type KingGuardPersonalRecord = {
	guard: KingGuardDisplay;

	// Position among the players who beat a king guard, ties broken by who beat its best guard first
	rank: number;
	challengers: number;
};

/**
 * Best king guard beaten by a player
 */
export type KingGuardChallengerRecord = {
	keycloakId: string;
	guard: KingGuardDisplay;
};

/**
 * Summary of all the fights of a player against the king guards
 */
export type KingGuardFightStats = {
	won: number;
	lost: number;
	draw: number;

	// Current level of the player, to tell how far above it its best guard is
	playerLevel: number;

	// Absent until the player beats a king guard
	record?: KingGuardPersonalRecord;

	// Players who beat the best king guards, the kingdom record first (see FightConstants.KING_GUARD.LEADERBOARD_SIZE)
	leaderboard: KingGuardChallengerRecord[];
};
