import {ReactElement} from "react";
import {Button, View} from "react-native";
import {fireEvent, render, screen} from "@testing-library/react-native";
import {StackRouter} from "expo-router/build/layouts/StackClient";
import {StackActions} from "expo-router/build/react-navigation/native";
import {useOpenGuild, useOpenPlayer} from "@/src/navigation/OtherProfiles";

const mockStack = StackRouter({initialRouteName: "rankings"});
const mockOptions = {
	routeNames: ["rankings", "player/[ref]", "guilds/[name]"],
	routeParamList: {rankings: {page: 4, timing: "week", scrollPosition: 235}},
	routeGetIdList: {}
};
let mockState = mockStack.getInitialState(mockOptions);
let mockSegments = ["(protected)", "(tabs)", "arena", "[page]"];

type ProfileHref = {pathname: string; params: Record<string, string>};

const mockPush = jest.fn((href: ProfileHref): void => {
	const name = "ref" in href.params ? "player/[ref]" : "guilds/[name]";
	const next = mockStack.getStateForAction(mockState, StackActions.push(name, href.params), mockOptions);
	if (!next) throw new Error("Unexpected profile push");
	mockState = mockStack.getRehydratedState(next, mockOptions);
});
const mockDismiss = jest.fn((count: number): void => {
	const next = mockStack.getStateForAction(mockState, StackActions.pop(count), mockOptions);
	if (!next) throw new Error("Unexpected profile pop");
	mockState = mockStack.getRehydratedState(next, mockOptions);
});

jest.mock("expo-router", () => ({
	useSegments: (): string[] => mockSegments,
	useNavigation: (): object => ({getState: (): typeof mockState => mockState}),
	useRouter: (): object => ({push: mockPush, dismiss: mockDismiss})
}));

function ProfileLinks(): ReactElement {
	const openPlayer = useOpenPlayer();
	const openGuild = useOpenGuild();
	return <View>
		<Button title="Joueur A" onPress={(): void => openPlayer("player-a")} />
		<Button title="Membre A" onPress={(): void => openPlayer("player-a", "Aurore")} />
		<Button title="Membre B" onPress={(): void => openPlayer("player-b", "Aurore")} />
		<Button title="Guilde Aurore" onPress={(): void => openGuild("Aurore")} />
	</View>;
}

const REPEATED_LOOPS = 10;

describe("other profile navigation history", () => {
	beforeEach((): void => {
		jest.clearAllMocks();
		mockState = mockStack.getInitialState(mockOptions);
		mockSegments = ["(protected)", "(tabs)", "arena", "[page]"];
	});

	it("reuses the same player's screen without growing the stack or changing its ranking origin", async (): Promise<void> => {
		await render(<ProfileLinks />);
		const ranking = mockState.routes[0];
		await fireEvent.press(screen.getByText("Joueur A"));
		const player = mockState.routes[1];
		for (let loop = 0; loop < REPEATED_LOOPS; loop++) {
			await fireEvent.press(screen.getByText("Guilde Aurore"));
			await fireEvent.press(screen.getByText("Membre A"));
			expect(mockState.routes).toEqual([ranking, player]);
		}
		expect(mockDismiss).toHaveBeenCalledTimes(REPEATED_LOOPS);
		expect(mockState.routes[0]).toBe(ranking);
		expect(mockState.routes[0].params).toEqual(mockOptions.routeParamList.rankings);
		expect(mockState.routes[1].params).toEqual({ref: "player-a"});
	});

	it("keeps a different player as a new screen with a normal return to the guild", async (): Promise<void> => {
		await render(<ProfileLinks />);
		await fireEvent.press(screen.getByText("Joueur A"));
		await fireEvent.press(screen.getByText("Guilde Aurore"));
		const guild = mockState.routes[2];
		await fireEvent.press(screen.getByText("Membre B"));
		expect(mockState.routes).toHaveLength(4);
		expect(mockState.routes[3].params).toEqual({ref: "player-b", fromGuild: "Aurore"});
		expect(mockDismiss).not.toHaveBeenCalled();
		mockDismiss(1);
		expect(mockState.routes.at(-1)).toBe(guild);
	});

	it("removes old duplicate loops by returning to the first copy of the player", async (): Promise<void> => {
		await render(<ProfileLinks />);
		await fireEvent.press(screen.getByText("Joueur A"));
		const origin = [...mockState.routes];
		mockPush({pathname: "/arena/guilds/[name]", params: {name: "Aurore"}});
		mockPush({pathname: "/arena/player/[ref]", params: {ref: "player-a", fromGuild: "Aurore"}});
		mockPush({pathname: "/arena/guilds/[name]", params: {name: "Aurore"}});
		await fireEvent.press(screen.getByText("Membre A"));
		expect(mockState.routes).toEqual(origin);
		expect(mockDismiss).toHaveBeenLastCalledWith(3);
	});

	it("also returns to an existing guild and leaves an already open profile alone", async (): Promise<void> => {
		await render(<ProfileLinks />);
		await fireEvent.press(screen.getByText("Joueur A"));
		await fireEvent.press(screen.getByText("Guilde Aurore"));
		const guild = mockState.routes[2];
		await fireEvent.press(screen.getByText("Membre B"));
		await fireEvent.press(screen.getByText("Guilde Aurore"));
		expect(mockState.routes).toHaveLength(3);
		expect(mockState.routes.at(-1)).toBe(guild);
		const pushCount = mockPush.mock.calls.length;
		const dismissCount = mockDismiss.mock.calls.length;
		await fireEvent.press(screen.getByText("Guilde Aurore"));
		expect(mockPush).toHaveBeenCalledTimes(pushCount);
		expect(mockDismiss).toHaveBeenCalledTimes(dismissCount);
	});

	it.each(["profile", "arena", "guild", undefined])("opens new profiles in their originating stack (%s)", async (tab): Promise<void> => {
		mockSegments = tab ? ["(protected)", "(tabs)", tab] : ["(protected)", "player", "[ref]"];
		await render(<ProfileLinks />);
		await fireEvent.press(screen.getByText("Joueur A"));
		expect(mockPush).toHaveBeenLastCalledWith({pathname: tab ? `/${tab}/player/[ref]` : "/player/[ref]", params: {ref: "player-a"}});
		await fireEvent.press(screen.getByText("Guilde Aurore"));
		expect(mockPush).toHaveBeenLastCalledWith({pathname: tab ? `/${tab}/guilds/[name]` : "/guilds/[name]", params: {name: "Aurore"}});
	});
});