import {ReactNode, useState} from "react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {AppConstants} from "@/src/AppConstants";

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
export function GameQueryProvider({ children, client }: { children: ReactNode; client?: QueryClient }): ReactNode {
	const [queryClient] = useState(() => client ?? createGameQueryClient());

	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
