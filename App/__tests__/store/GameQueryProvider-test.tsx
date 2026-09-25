import {ReactElement} from "react";
import {render, screen, waitFor} from "@testing-library/react-native";
import {Text} from "react-native";
import {useQuery} from "@tanstack/react-query";
import {MissionsCompletedRes} from "ws-packets/src/fromServer/missions/MissionsCompletedRes";
import {MISSION_TYPES} from "ws-packets/src/objects/Mission";
import {AuthStateEnum} from "@/src/authentication/AuthStateEnum";
import {WebSocketClient} from "@/src/networking/WebSocketClient";
import {GAME_ENTITIES, gameKey} from "@/src/store/GameEntities";
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

function MissionReader({read}: {read: () => Promise<string>}): ReactElement {
	const query = useQuery({queryKey: gameKey(GAME_ENTITIES.MISSIONS), queryFn: read});
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

	it("refreshes a fresh mission page when two missions complete together", async () => {
		let missionName = "earn 100";
		const read = jest.fn(async (): Promise<string> => missionName);
		const view = await render(<GameQueryProvider><MissionReader read={read} /></GameQueryProvider>);
		await waitFor(() => expect(screen.getByText("earn 100")).toBeTruthy());

		missionName = "next campaign mission";
		const reward = {points: 0, experience: 0, gems: 0, money: 0};
		const completion = new MissionsCompletedRes();
		completion.missions = [MISSION_TYPES.CAMPAIGN, MISSION_TYPES.DAILY].map(missionType => ({
			mission: {missionId: "earnMoney", missionObjective: 100, missionVariant: 0, numberDone: 100, missionType},
			reward
		}));
		const registry = Reflect.get(WebSocketClient.getInstance(), "pushedPacketRegistry");
		registry.dispatch(MissionsCompletedRes.wireName, completion);

		await waitFor(() => expect(screen.getByText("next campaign mission")).toBeTruthy());
		expect(read).toHaveBeenCalledTimes(2);
		view.unmount();
	});
});
