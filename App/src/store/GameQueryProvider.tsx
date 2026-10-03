import {ReactNode, useEffect, useRef, useState} from "react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {MissionsCompletedRes} from "ws-packets/src/fromServer/missions/MissionsCompletedRes";
import {BlessingActivatedRes} from "ws-packets/src/fromServer/character/BlessingActivatedRes";
import {RoyalLetterRes} from "ws-packets/src/fromServer/onboarding/RoyalLetterRes";
import {AppConstants} from "@/src/AppConstants";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";

/**
 * Builds the cache holding the game state.
 *
 * Exported so a test can fill it by hand and render a screen without a socket.
 */
export function createGameQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: AppConstants.GAME_STATE_STALE_TIME,
				gcTime: Infinity,

				// A request already waits a long time before giving up; retrying would double that wait
				retry: false
			}
		}
	});
}

function refresh(queryClient: QueryClient, entity: typeof GAME_ENTITIES[keyof typeof GAME_ENTITIES]): void {
	queryClient.invalidateQueries({queryKey: gameKey(entity)}).catch(error => {
		console.error(`Failed to refresh ${entity} after a reward:`, error);
	});
}

/**
 * Completed missions change the list, and Core now keeps them to show; a token reward also changes
 * what the report offers to spend. A royal letter is kept the same way.
 */
function useRewardsRefresh(queryClient: QueryClient): void {
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler<MissionsCompletedRes>(MissionsCompletedRes.wireName, packet => {
		if (packet.missions.length === 0) return;
		refresh(queryClient, GAME_ENTITIES.MISSIONS);
		refresh(queryClient, GAME_ENTITIES.APP_STATE);
		if (packet.missions.some(completed => completed.reward.tokens)) refresh(queryClient, GAME_ENTITIES.REPORT);
	}), [queryClient]);
	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler(RoyalLetterRes.wireName, () => {
		refresh(queryClient, GAME_ENTITIES.APP_STATE);
	}), [queryClient]);
}

/**
 * Makes the game state available to every screen below it.
 * @param children Screens reading the game state
 * @param client Cache to use instead of a fresh one, for tests
 */
export function GameQueryProvider({ children, client, authState }: {
	children: ReactNode;
	client?: QueryClient;
	authState?: AuthStateEnum;
}): ReactNode {
	const [queryClient] = useState(() => client ?? createGameQueryClient());
	const previousAuthState = useRef<AuthStateEnum>(AuthStateEnum.NOT_READY);

	useRewardsRefresh(queryClient);

	useEffect(() => WebSocketClient.getInstance().registerPushedPacketHandler(BlessingActivatedRes.wireName, () => {
		queryClient.invalidateQueries({queryKey: gameKey(GAME_ENTITIES.BLESSING)}).catch(error => {
			console.error("Failed to refresh the blessing after its activation:", error);
		});
	}), [queryClient]);

	useEffect(() => {
		const hasReconnected = authState === AuthStateEnum.LOGGED_IN
			&& previousAuthState.current !== AuthStateEnum.LOGGED_IN;
		if (authState !== undefined) {
			previousAuthState.current = authState;
		}
		if (hasReconnected) {
			queryClient.invalidateQueries().catch(error => {
				console.error("Failed to refresh game state after reconnection:", error);
			});
		}
	}, [authState, queryClient]);

	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
