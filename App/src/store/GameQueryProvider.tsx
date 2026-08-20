import {ReactNode, useEffect, useRef, useState} from "react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {AppConstants} from "@/src/AppConstants";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";

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

				// A request already waits a long time before giving up; retrying would double that wait
				retry: false
			}
		}
	});
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
