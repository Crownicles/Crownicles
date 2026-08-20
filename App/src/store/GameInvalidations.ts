import {useCallback} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {ReactionCollectorDataKind} from "ws-packets/src/fromServer/collectors";
import {DRINK_DATA_KINDS} from "ws-packets/src/fromServer/collectors/families/DrinkCollector";
import {GAME_ENTITIES, gameKey, GameEntity} from "@/src/store/GameEntities";

/**
 * What answering a collector changes in the game state.
 *
 * Declared here rather than in the screen that opened the collector: that screen has no way of
 * knowing everything the server touches, and drinking a potion is resolved long after the screen
 * asked for it. The profile is always invalidated because a resolved action may change progression
 * or another value displayed by the profile. The table adds entities specific to a kind.
 */
const COLLECTOR_INVALIDATES: Partial<Record<ReactionCollectorDataKind, readonly GameEntity[]>> = {
	[DRINK_DATA_KINDS.COLLECTOR]: [GAME_ENTITIES.INVENTORY]
};

/**
 * Refreshes the views a player action made obsolete.
 *
 * Screens call this with what the player answered, never with the list of things to reload.
 */
export function useGameInvalidations(): { afterCollector: (kind: ReactionCollectorDataKind) => void } {
	const queryClient = useQueryClient();

	const afterCollector = useCallback((kind: ReactionCollectorDataKind): void => {
		const entities = new Set<GameEntity>([
			GAME_ENTITIES.PROFILE,
			...(COLLECTOR_INVALIDATES[kind] ?? [])
		]);
		for (const entity of entities) {
			queryClient.invalidateQueries({ queryKey: gameKey(entity) }).catch((error) => {
				console.error(`Failed to invalidate ${entity}:`, error);
			});
		}
	}, [queryClient]);

	return { afterCollector };
}
