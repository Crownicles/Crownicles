import {ReactElement} from "react";
import {render, waitFor} from "@testing-library/react-native";
import {Text} from "react-native";
import {useQuery} from "@tanstack/react-query";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {GameQueryProvider} from "@/src/store/GameQueryProvider";

function ProfileReader({onRead}: { onRead: () => void }): ReactElement {
	const query = useQuery({
		queryKey: ["profile"],
		queryFn: async (): Promise<string> => {
			onRead();
			return "profile";
		}
	});

	return <Text>{query.data}</Text>;
}

describe("GameQueryProvider", () => {
	it("refreshes cached game state when authentication reconnects", async () => {
		let reads = 0;
		const screen = await render(
			<GameQueryProvider authState={AuthStateEnum.CONNECTING}>
				<ProfileReader onRead={() => reads++} />
			</GameQueryProvider>
		);

		await waitFor(() => expect(reads).toBe(1));

		await screen.rerender(
			<GameQueryProvider authState={AuthStateEnum.LOGGED_IN}>
				<ProfileReader onRead={() => reads++} />
			</GameQueryProvider>
		);

		await waitFor(() => expect(reads).toBe(2));
		screen.unmount();
	});
});
