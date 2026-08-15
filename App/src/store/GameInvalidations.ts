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
 * asked for it. A collector kind missing from this table simply invalidates nothing.
 */
const COLLECTOR_INVALIDATES: Partial<Record<ReactionCollectorDataKind, readonly GameEntity[]>> = {
	[DRINK_DATA_KINDS.COLLECTOR]: [GAME_ENTITIES.PROFILE, GAME_ENTITIES.INVENTORY]
};

/**
 * Refreshes the views a player action made obsolete.
 *
 * Screens call this with what the player answered, never with the list of things to reload.
 */
export function useGameInvalidations(): { afterCollector: (kind: ReactionCollectorDataKind) => void } {
	const queryClient = useQueryClient();

	const afterCollector = useCallback((kind: ReactionCollectorDataKind): void => {
		for (const entity of COLLECTOR_INVALIDATES[kind] ?? []) {
			void queryClient.invalidateQueries({ queryKey: gameKey(entity) });
		}
	}, [queryClient]);

	return { afterCollector };
}
