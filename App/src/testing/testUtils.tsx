import {ReactNode} from "react";
import {render} from "@testing-library/react-native";
import {QueryClient} from "@tanstack/react-query";
import {GameQueryProvider} from "@/src/store/GameQueryProvider";

const testQueryClients = new Set<QueryClient>();

export async function renderWithGameQuery(children: ReactNode): Promise<Awaited<ReturnType<typeof render>>> {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				gcTime: Infinity
			}
		}
	});
	testQueryClients.add(queryClient);

	return await render(<GameQueryProvider client={queryClient}>{children}</GameQueryProvider>);
}

export function clearTestQueryClients(): void {
	for (const queryClient of testQueryClients) {
		queryClient.clear();
	}
	testQueryClients.clear();
}
