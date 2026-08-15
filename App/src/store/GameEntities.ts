/**
 * The pieces of game state screens read.
 *
 * Actions declare which of these they invalidate, so no screen has to know what a given action
 * changed elsewhere in the game.
 */
export const GAME_ENTITIES = {
	PROFILE: "profile",
	PET: "pet",
	INVENTORY: "inventory",
	GUILD: "guild",
	MISSIONS: "missions"
} as const;

export type GameEntity = typeof GAME_ENTITIES[keyof typeof GAME_ENTITIES];

export type GameQueryKey = readonly [GameEntity];

/**
 * Builds the cache key of an entity.
 *
 * Reads and invalidations both go through here, so the two can never drift apart.
 * @param entity Piece of game state being addressed
 */
export function gameKey(entity: GameEntity): GameQueryKey {
	return [entity];
}
