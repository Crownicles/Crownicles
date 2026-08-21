import {useCallback} from "react";
import {useFocusEffect} from "expo-router";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {FromServerPacket} from "ws-packets/src/fromServer/FromServerPacket";
import {GameAnswer} from "@/src/networking/GameClient";
import {gameKey, GameEntity} from "@/src/store/GameEntities";
import {AppConstants} from "@/src/AppConstants";

export type RequestState<Answer extends FromServerPacket> =
	| { status: "loading" }
	| { status: "ready"; data: Answer }
	| { status: "empty"; packetName: string }
	| { status: "failed" };

/**
 * An answer the server actually gave.
 *
 * A command answering "there is no pet" is a legitimate result, not a failure, so only the absence
 * of any answer is excluded here and turned into an error the cache can retry.
 */
type SettledAnswer<Answer extends FromServerPacket> = Exclude<GameAnswer<Answer>, { kind: "timeout" }>;

/**
 * A request the server never answered.
 */
export class GameRequestTimeout extends Error {
	public constructor() {
		super("The server did not answer in time");
	}
}

function isGameStateOutdated(dataUpdatedAt: number | undefined): boolean {
	return !dataUpdatedAt || Date.now() - dataUpdatedAt >= AppConstants.GAME_STATE_STALE_TIME;
}

function refreshGameStateOnFocus(queryClient: ReturnType<typeof useQueryClient>, entity: GameEntity): void {
	const cached = queryClient.getQueryState(gameKey(entity));
	if (!isGameStateOutdated(cached?.dataUpdatedAt)) {
		return;
	}

	queryClient.refetchQueries({queryKey: gameKey(entity), type: "active"})
		.catch(error => console.error("Failed to refresh the game state on focus:", error));
}

/**
 * Reads a piece of game state through the shared cache.
 *
 * Two screens asking for the same entity share a single request, and an action that invalidates
 * that entity refreshes both of them. Screens receive the states they have to render and never
 * touch the socket, so they can be exercised against a cache filled by hand.
 * @param entity Piece of game state being read
 * @param run Performs the request when the cache needs a fresh value
 */
export function useGameQuery<Answer extends FromServerPacket>(
	entity: GameEntity,
	run: () => Promise<GameAnswer<Answer>>
): RequestState<Answer> {
	const query = useQuery<SettledAnswer<Answer>>({
		queryKey: gameKey(entity),
		queryFn: async (): Promise<SettledAnswer<Answer>> => {
			const answer = await run();
			if (answer.kind === "timeout") {
				throw new GameRequestTimeout();
			}
			return answer;
		}
	});

	/*
	 * Tab screens stay mounted, so the cache would otherwise keep serving what was read the first
	 * time the screen was opened. The age of the cached answer is compared here rather than through
	 * the cache's own stale filter, which only reflects what the last render computed.
	 */
	const queryClient = useQueryClient();
	useFocusEffect(useCallback((): void => {
		refreshGameStateOnFocus(queryClient, entity);
	}, [queryClient, entity]));

	if (query.isPending) {
		return { status: "loading" };
	}
	if (query.isError) {
		return { status: "failed" };
	}
	return query.data.kind === "alternative"
		? { status: "empty", packetName: query.data.packetName }
		: { status: "ready", data: query.data.packet };
}
